// src/components/OrderSheetModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { ref, onValue } from "firebase/database";
import { useCart } from "../store/useCart.js";

/**
 * 用法：
 * <OrderSheetModal open={!!openSheet} stallId={openSheet} onClose={()=>setOpenSheet(null)} />
 *
 * 特色：
 * - 從 /stalls/{stallId}/items 載入商品；若無資料，使用 fallback。
 * - 點「加入購物袋」時，會寫入 { stallId, id, name, price, qty } 給 useCart。
 * - 單品一次加 1，重複點擊會累加數量。
 * - 有「已加入！」的微提示。
 */

const FALLBACK_BY_STALL = {
  chicken: [
    { id: "c1", name: "舒肥雞胸（原味）", price: 50, img: "" },
    { id: "c2", name: "舒肥雞胸（檸檬）", price: 55, img: "" },
  ],
  cannele: [
    { id: "k1", name: "可麗露（原味）", price: 70, img: "" },
    { id: "k2", name: "可麗露（抹茶）", price: 80, img: "" },
  ],
};

export default function OrderSheetModal({ open, stallId = "chicken", onClose }) {
  const { addToCart } = useCart();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [justAdded, setJustAdded] = useState(null); // 顯示「已加入！」

  // 載入 /stalls/{stallId}/items；無資料→ fallback
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const r = ref(db, `stalls/${stallId}/items`);
    const off = onValue(
      r,
      (snap) => {
        const val = snap.val();
        if (val && typeof val === "object") {
          const list = Array.isArray(val) ? val.filter(Boolean) : Object.values(val);
          setItems(
            list.map((it) => ({
              id: String(it.id ?? ""),
              name: String(it.name ?? ""),
              price: Number(it.price ?? 0),
              img: it.img ?? "",
            }))
          );
        } else {
          setItems(FALLBACK_BY_STALL[stallId] || []);
        }
        setLoading(false);
      },
      () => {
        setItems(FALLBACK_BY_STALL[stallId] || []);
        setLoading(false);
      }
    );
    return () => off();
  }, [open, stallId]);

  const title = useMemo(() => {
    if (stallId === "chicken") return "🐔 雞胸肉清單";
    if (stallId === "cannele") return "🍮 可麗露清單";
    return `🛒 ${stallId} 清單`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stallId]);

  if (!open) return null;

  const handleAdd = async (it) => {
    await addToCart({
      stallId,      // ★ 關鍵：帶上攤位 ID
      id: it.id,
      name: it.name,
      price: Number(it.price) || 0,
      qty: 1,
    });
    setJustAdded(it.id);
    setTimeout(() => setJustAdded(null), 800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.28)",
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 12,
      }}
      onClick={(e) => {
        // 點背景關閉
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          width: "min(960px, 92vw)",
          maxHeight: "86vh",
          overflow: "auto",
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 16,
          boxShadow: "0 16px 36px rgba(0,0,0,.22)",
        }}
      >
        {/* 標題列 */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "#fff",
            borderBottom: "1px solid #f0f0f0",
            padding: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            zIndex: 1,
          }}
        >
          <strong style={{ fontSize: 18 }}>{title}</strong>
          <button onClick={onClose} className="small-btn">✕ 關閉</button>
        </div>

        {/* 清單 */}
        <div
          style={{
            padding: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {loading && <div>載入中…</div>}
          {!loading && items.length === 0 && (
            <div style={{ color: "#64748b" }}>目前沒有可購買的商品</div>
          )}

          {items.map((it) => (
            <div
              key={it.id}
              className="card"
              style={{
                padding: 12,
                borderRadius: 12,
                position: "relative",
                border: "1px solid #eee",
                background: "#fff",
              }}
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
              <div style={{ margin: "6px 0" }}>價格：🪙 {Number(it.price) || 0}</div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button type="button" onClick={() => handleAdd(it)}>
                  加入購物袋
                </button>
                {justAdded === it.id && (
                  <span style={{ fontSize: 12, color: "#16a34a" }}>已加入！</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 底部操作列 */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: "#fff",
            borderTop: "1px solid #f0f0f0",
            padding: 12,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
          }}
        >
          <button onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  );
}
