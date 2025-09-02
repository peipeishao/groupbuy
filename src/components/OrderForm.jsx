// src/components/OrderForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ref, onValue, push, serverTimestamp } from "firebase/database";
import { db } from "../firebase.js";
import { usePlayer } from "../store/playerContext.jsx";

/**
 * 使用方式：
 * <OrderForm stallId="chicken" DEADLINE="2025-12-31T23:59:00+08:00" />
 * - stallId：從 /stalls/{stallId}/items 載入商品；若無資料，用內建 fallback。
 * - DEADLINE（可選）：截止時間（ISO 字串）。超過時間會禁止送單。
 */

const FALLBACK_BY_STALL = {
  chicken: [
    { id: "c1", name: "舒肥雞胸（原味）", price: 50, stock: 999, img: "" },
    { id: "c2", name: "舒肥雞胸（檸檬）", price: 55, stock: 999, img: "" },
  ],
  cannele: [
    { id: "k1", name: "可麗露（原味）", price: 70, stock: 999, img: "" },
    { id: "k2", name: "可麗露（抹茶）", price: 80, stock: 999, img: "" },
  ],
};

export default function OrderForm({ stallId = "chicken", DEADLINE }) {
  const { uid, profile } = usePlayer();

  const [items, setItems] = useState([]);     // 可購買商品清單
  const [qty, setQty] = useState({});         // {itemId: number}
  const [name, setName] = useState(profile?.realName || "");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  // 載入商品：優先 RTDB /stalls/{stallId}/items，否則用 fallback
  useEffect(() => {
    const r = ref(db, `stalls/${stallId}/items`);
    const off = onValue(r, (snap) => {
      const val = snap.val();
      if (val && typeof val === "object") {
        const list = Array.isArray(val) ? val.filter(Boolean) : Object.values(val);
        setItems(list.map((it) => ({
          id: String(it.id ?? ""),
          name: String(it.name ?? ""),
          price: Number(it.price ?? 0),
          img: it.img ?? "",
          stock: Number(it.stock ?? 0),
        })));
      } else {
        setItems(FALLBACK_BY_STALL[stallId] || []);
      }
      setLoading(false);
    }, () => {
      setItems(FALLBACK_BY_STALL[stallId] || []);
      setLoading(false);
    });
    return () => off();
  }, [stallId]);

  const withinDeadline = useMemo(() => {
    if (!DEADLINE) return true;
    const now = Date.now();
    const end = Date.parse(DEADLINE);
    return isFinite(end) ? now <= end : true;
  }, [DEADLINE]);

  const selected = useMemo(() => {
    return items
      .map((it) => ({ ...it, qty: Number(qty[it.id]) || 0 }))
      .filter((it) => it.qty > 0);
  }, [items, qty]);

  const total = useMemo(
    () => selected.reduce((s, it) => s + it.qty * (Number(it.price) || 0), 0),
    [selected]
  );

  const inc = (id, delta) => {
    setQty((q) => {
      const next = Math.max(0, (Number(q[id]) || 0) + delta);
      return { ...q, [id]: next };
    });
  };

  async function submitOrder(e) {
    e?.preventDefault?.();

    if (!uid) {
      alert("尚未登入，請先登入再送單。");
      return;
    }
    if (!withinDeadline) {
      alert("已超過收單時間，無法送出。");
      return;
    }
    if (!name.trim() || !contact.trim()) {
      alert("請填寫『姓名』與『聯絡方式』");
      return;
    }
    if (selected.length === 0 || total <= 0) {
      alert("請選擇至少 1 個品項");
      return;
    }

    // ✅ 將每個 item 加上 stallId，符合 OrdersSummaryTable 的聚合需求
    const orderItems = selected.map((it) => ({
      stallId,          // ★ 這行是關鍵：每個品項附上攤位 ID
      id: it.id,
      name: it.name,
      price: Number(it.price) || 0,
      qty: Number(it.qty) || 0,
    }));

    const payload = {
      uid,
      orderedBy: {
        uid,
        roleName: profile?.roleName || (profile?.name || "旅人"),
        avatar: profile?.avatar || "bunny",
      },
      name: name.trim(),
      contact: contact.trim(),
      note: note.trim() || null,
      items: orderItems,
      total,
      status: "submitted",
      paid: false,
      paidAt: null,
      last5: null,
      // 用毫秒時間，避免 serverTimestamp() 在前端成為物件造成排序困難
      createdAt: Date.now(),
      createdAtSrv: serverTimestamp(), // 想要後端時間可留著參考
    };

    try {
      await push(ref(db, "orders"), payload);
      // 清空選擇
      setQty({});
      alert("已送出訂單，感謝下單！");
    } catch (err) {
      console.error(err);
      alert("送單失敗，請稍後再試");
    }
  }

  return (
    <form
      onSubmit={submitOrder}
      className="card"
      style={{ maxWidth: 820, margin: "0 auto" }}
    >
      <h3 style={{ marginTop: 0 }}>
        {stallId === "chicken" ? "🐔 雞胸肉團購" :
         stallId === "cannele" ? "🍮 可麗露團購" : `🛒 ${stallId} 團購`}
      </h3>

      {/* 收單狀態 */}
      {DEADLINE && (
        <div style={{ marginBottom: 8 }}>
          收單截止：<strong>{new Date(DEADLINE).toLocaleString()}</strong>{" "}
          {withinDeadline ? (
            <span style={{ color: "#16a34a" }}>（可下單）</span>
          ) : (
            <span style={{ color: "#b91c1c" }}>（已截止）</span>
          )}
        </div>
      )}

      {/* 商品清單 */}
      <div
        className="product-list"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {loading && <div>載入中…</div>}
        {!loading && items.length === 0 && (
          <div style={{ color: "#64748b" }}>目前沒有可購買的商品</div>
        )}
        {items.map((it) => {
          const count = Number(qty[it.id]) || 0;
          return (
            <div
              key={it.id}
              className="card"
              style={{ padding: 12, borderRadius: 12 }}
            >
              {it.img ? (
                <img
                  src={it.img}
                  alt={it.name}
                  style={{
                    width: "100%",
                    height: 140,
                    objectFit: "cover",
                    borderRadius: 10,
                    marginBottom: 8,
                  }}
                />
              ) : (
                <div
                  style={{
                    height: 140,
                    background: "#f1f5f9",
                    borderRadius: 10,
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 8,
                    color: "#64748b",
                    fontSize: 12,
                  }}
                >
                  無圖片
                </div>
              )}
              <div style={{ fontWeight: 700 }}>{it.name}</div>
              <div style={{ margin: "6px 0" }}>價格：🪙 {it.price}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => inc(it.id, -1)}
                  className="small-btn"
                >
                  −
                </button>
                <div style={{ minWidth: 24, textAlign: "center" }}>{count}</div>
                <button
                  type="button"
                  onClick={() => inc(it.id, +1)}
                  className="small-btn"
                >
                  ＋
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 個人資訊 */}
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <div>
          <label>姓名</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="王小明"
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <label>聯絡方式</label>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="電話 / Line"
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <label>備註</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="口味、收貨備註等…"
          style={{ width: "100%" }}
        />
      </div>

      {/* 合計 / 送出 */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 700 }}>合計：🪙 {total}</div>
        <button type="submit" disabled={!withinDeadline || total <= 0}>
          送出訂單
        </button>
      </div>
    </form>
  );
}
