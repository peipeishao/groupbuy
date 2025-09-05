// src/components/OrderForm.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ref, onValue, push, serverTimestamp } from "firebase/database";
import { db } from "../firebase.js";
import { usePlayer } from "../store/playerContext.jsx";

/**
 * 使用方式：
 * <OrderForm stallId="chicken" DEADLINE="2025-12-31T23:59:00+08:00" />
 *
 * 讀取優先序（自動 fallback）：
 *  1) /stalls/{stallId}/items                 ← 舊資料格式（若有就用）
 *  2) /products/{stallId}                     ← 舊版分攤位資料（仍支援）
 *  3) /products                               ← 新版扁平資料（嚴格以 category===stallId 篩選）
 *
 * 顯示邏輯：
 *  - products/{stallId}：使用 priceGroup 當售價、priceOriginal 當原價，僅顯示 active !== false
 *  - products（扁平）：使用 price 當售價、original 當原價，且「只顯示」category===stallId
 *  - stalls/{stallId}/items：沿用你原欄位（price），沒有原價就不顯示
 */

// 內建備援
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

const fmt1 = (n) =>
  new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(n) || 0);

export default function OrderForm({ stallId = "chicken", DEADLINE }) {
  const { uid, profile } = usePlayer();

  const [items, setItems] = useState([]);     // {id, name, price, original?, img?, unit?}
  const [qty, setQty] = useState({});         // {itemId: number}
  const [name, setName] = useState(profile?.realName || "");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  // 除錯用：實際採用的來源
  const sourceRef = useRef("none");

  useEffect(() => {
    let offStalls = null;
    let offProductsByStall = null;
    let offProductsFlat = null;

    setLoading(true);
    sourceRef.current = "none";

    const tryProductsFlat = () => {
      if (offProductsFlat) return;
      // 3) /products（扁平；嚴格以 category===stallId）
      const r3 = ref(db, "products");
      offProductsFlat = onValue(
        r3,
        (snap) => {
          const v = snap.val();
          if (v && typeof v === "object") {
            const list = Object.entries(v).map(([id, p]) => ({
              id,
              name: String(p?.name ?? ""),
              price: Number(p?.price ?? 0),
              original: p?.original != null ? Number(p.original) : undefined,
              img: String(p?.imageUrl ?? ""),
              unit: String(p?.unit ?? "包"),
              category: String(p?.category ?? ""),
              createdAt: Number(p?.createdAt ?? 0),
              active: p?.active !== false,
            }));

            // ✅ 嚴格只顯示屬於該攤位的品項
            const filtered = list
              .filter(
                (it) =>
                  it.active &&
                  it.price > 0 &&
                  (!stallId || it.category === String(stallId))
              )
              .sort(
                (a, b) =>
                  b.createdAt - a.createdAt ||
                  String(a.name).localeCompare(String(b.name))
              );

            if (filtered.length > 0) {
              setItems(
                filtered.map(({ active, createdAt, category, ...it }) => it)
              );
              setLoading(false);
              sourceRef.current = "productsFlat";
              return;
            }
          }
          // 三種來源都沒有 → fallback
          setItems(FALLBACK_BY_STALL[stallId] || []);
          setLoading(false);
          sourceRef.current = "fallback";
        },
        () => {
          setItems(FALLBACK_BY_STALL[stallId] || []);
          setLoading(false);
          sourceRef.current = "fallback";
        }
      );
    };

    const tryProductsByStall = () => {
      if (offProductsByStall) return;
      // 2) /products/{stallId}（舊版分攤位）
      const r2 = ref(db, `products/${stallId}`);
      offProductsByStall = onValue(
        r2,
        (snap) => {
          const v = snap.val();
          if (v && typeof v === "object") {
            const list = Object.entries(v)
              .map(([id, p]) => ({
                id,
                name: String(p?.name ?? ""),
                // 以團購價為售價（相容舊結構）
                price:
                  p?.priceGroup != null
                    ? Number(p.priceGroup)
                    : Number(p?.price ?? 0),
                // 原價（相容舊結構）
                original:
                  p?.priceOriginal != null
                    ? Number(p.priceOriginal)
                    : p?.original != null
                    ? Number(p.original)
                    : undefined,
                img: String(p?.imageUrl ?? ""),
                unit: String(p?.unit ?? "包"),
                active: p?.active !== false,
                createdAt: Number(p?.createdAt ?? 0),
              }))
              .filter((it) => it.active && it.price > 0);

            if (list.length > 0) {
              list.sort(
                (a, b) =>
                  b.createdAt - a.createdAt ||
                  String(a.name).localeCompare(String(b.name))
              );
              setItems(list.map(({ active, createdAt, ...it }) => it));
              setLoading(false);
              sourceRef.current = "productsByStall";
              // 有 byStall 就不需要 flat 了
              if (offProductsFlat) {
                offProductsFlat();
                offProductsFlat = null;
              }
              return;
            }
          }
          // byStall 無資料 → 試扁平 products
          tryProductsFlat();
        },
        () => {
          tryProductsFlat();
        }
      );
    };

    // 1) /stalls/{stallId}/items（最優先，若有就用）
    const r1 = ref(db, `stalls/${stallId}/items`);
    offStalls = onValue(
      r1,
      (snap) => {
        const v = snap.val();
        if (v && typeof v === "object") {
          const list = (Array.isArray(v) ? v.filter(Boolean) : Object.values(v))
            .map((it) => ({
              id: String(it.id ?? ""),
              name: String(it.name ?? ""),
              price: Number(it.price ?? 0),
              original:
                it.original != null ? Number(it.original) : undefined,
              img: String(it.img ?? ""),
              unit: String(it.unit ?? "包"),
            }))
            .filter((it) => it.price > 0);

        if (list.length > 0) {
            setItems(list);
            setLoading(false);
            sourceRef.current = "stalls";
            // 關掉其他監聽
            if (offProductsByStall) { offProductsByStall(); offProductsByStall = null; }
            if (offProductsFlat) { offProductsFlat(); offProductsFlat = null; }
            return;
          }
        }
        // stalls 無資料 → 試 products/{stallId}
        tryProductsByStall();
      },
      () => {
        // 讀 stalls 失敗 → 試 products/{stallId}
        tryProductsByStall();
      }
    );

    return () => {
      offStalls && offStalls();
      offProductsByStall && offProductsByStall();
      offProductsFlat && offProductsFlat();
    };
  }, [stallId]);

  const withinDeadline = useMemo(() => {
    if (!DEADLINE) return true;
    const now = Date.now();
    const end = Date.parse(DEADLINE);
    return isFinite(end) ? now <= end : true;
  }, [DEADLINE]);

  const selected = useMemo(
    () =>
      items
        .map((it) => ({ ...it, qty: Number(qty[it.id]) || 0 }))
        .filter((it) => it.qty > 0),
    [items, qty]
  );

  const total = useMemo(
    () =>
      selected.reduce(
        (s, it) => s + it.qty * (Number(it.price) || 0),
        0
      ),
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
    if (!String(name).trim() || !String(contact).trim()) {
      alert("請填寫『姓名』與『聯絡方式』");
      return;
    }
    if (selected.length === 0 || total <= 0) {
      alert("請選擇至少 1 個品項");
      return;
    }

    const orderItems = selected.map((it) => ({
      stallId,
      id: it.id,
      name: it.name,
      price: Number(it.price) || 0,
      qty: Number(it.qty) || 0,
    }));

    const payload = {
      uid,
      orderedBy: {
        uid,
        roleName: profile?.roleName || "旅人",
        avatar: profile?.avatar || "bunny",
      },
      name: String(name).trim(),
      contact: String(contact).trim(),
      note: String(note).trim() || null,
      items: orderItems,
      total,
      status: "submitted",
      paid: false,
      paidAt: null,
      last5: null,
      createdAt: Date.now(),
      createdAtSrv: serverTimestamp(),
    };

    try {
      await push(ref(db, "orders"), payload);
      setQty({});
      alert("已送出訂單，感謝下單！");
    } catch (err) {
      console.error(err);
      alert("送單失敗，請稍後再試");
    }
  }

  return (
    <form onSubmit={submitOrder} className="card" style={{ maxWidth: 820, margin: "0 auto" }}>
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
            <div key={it.id} className="card" style={{ padding: 12, borderRadius: 12 }}>
              {it.img ? (
                <img
                  src={it.img}
                  alt={it.name}
                  style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 10, marginBottom: 8 }}
                />
              ) : (
                <div
                  style={{
                    height: 140, background: "#f1f5f9", borderRadius: 10,
                    display: "grid", placeItems: "center", marginBottom: 8, color: "#64748b", fontSize: 12,
                  }}
                >
                  無圖片
                </div>
              )}

              <div style={{ fontWeight: 700 }}>{it.name}</div>

              <div style={{ margin: "6px 0" }}>
                價格：🪙 {fmt1(it.price)}
                {typeof it.original === "number" && it.original > it.price && (
                  <span style={{ marginLeft: 6, color: "#64748b", textDecoration: "line-through" }}>
                    {fmt1(it.original)}
                  </span>
                )}
                {it.unit && <span style={{ marginLeft: 6, color: "#64748b" }}>／{it.unit}</span>}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" onClick={() => inc(it.id, -1)} className="small-btn">−</button>
                <div style={{ minWidth: 24, textAlign: "center" }}>{count}</div>
                <button type="button" onClick={() => inc(it.id, +1)} className="small-btn">＋</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 個人資訊 */}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label>姓名</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="王小明" style={{ width: "100%" }} />
        </div>
        <div>
          <label>聯絡方式</label>
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="電話 / Line" style={{ width: "100%" }} />
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <label>備註</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="口味、收貨備註等…" style={{ width: "100%" }} />
      </div>

      {/* 合計 / 送出 */}
      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontWeight: 700 }}>合計：🪙 {fmt1(total)}</div>
        <button type="submit" disabled={!withinDeadline || total <= 0}>送出訂單</button>
      </div>
    </form>
  );
}
