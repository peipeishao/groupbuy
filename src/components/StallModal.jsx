// src/components/StallModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { ref as dbRef, onValue, set, update } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";
import ReviewModal from "./reviews/ReviewModal.jsx";

const ntd1 = (n) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(n) || 0);

// 取得某個 item 的評論統計
function useReviewStats(itemId) {
  const [stats, setStats] = useState({ count: 0, avg: 0 });

  useEffect(() => {
    if (!itemId) return;
    const off = onValue(dbRef(db, `reviews/${itemId}`), (snap) => {
      const v = snap.val() || {};
      const arr = Object.values(v);
      const count = arr.length;
      const avg = count
        ? arr.reduce((s, r) => s + (Number(r.stars) || 0), 0) / count
        : 0;
      setStats({ count, avg });
    });
    return () => off();
  }, [itemId]);

  return stats;
}

/**
 * 單一商品卡片（在這裡使用 useReviewStats，避免在 map 裡呼叫 hook）
 */
function StallItemCard({ stallId, it, qty, setQty, addToCart, onOpenReview }) {
  const stats = useReviewStats(it.id); // ✅ Hook 放在元件最外層
  const price = Number(it.priceGroup ?? it.price ?? 0);
  const minQty = Math.max(1, Number(it.minQty || 1));

  return (
    <div key={`stall-${stallId}-prod-${it.id}`} style={card}>
      <div style={{ display: "flex", gap: 12 }}>
        {it.imageUrl ? (
          <img
            src={it.imageUrl}
            alt={it.name}
            style={{
              width: 100,
              height: 100,
              objectFit: "cover",
              borderRadius: 10,
            }}
          />
        ) : (
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: 10,
              background: "#f1f5f9",
              display: "grid",
              placeItems: "center",
              color: "#94a3b8",
            }}
          >
            無圖
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900 }}>{it.name}</div>

          {it.desc ? (
            <div
              style={{
                color: "#64748b",
                fontSize: 12,
                marginTop: 4,
              }}
            >
              {it.desc}
            </div>
          ) : null}

          {/* 價格 */}
          <div style={{ marginTop: 6, fontWeight: 800 }}>
            團購價：{ntd1(price)} {it.unit ? `／${it.unit}` : ""}
            {it.priceOriginal ? (
              <span
                style={{
                  color: "#94a3b8",
                  marginLeft: 8,
                  textDecoration: "line-through",
                }}
              >
                原價 {ntd1(it.priceOriginal)}
              </span>
            ) : null}
          </div>

          {/* ⭐ 評論摘要 */}
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: "#475569",
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexWrap: "wrap",
            }}
          >
            <span title={`平均 ${stats.avg.toFixed(1)} 星`}>
              {"★".repeat(Math.round(stats.avg || 0)) || "☆"}
              <span style={{ color: "#94a3b8", marginLeft: 4 }}>
                （{stats.count} 則評論）
              </span>
            </span>
            <button
              onClick={() => onOpenReview({ id: it.id, name: it.name })}
              style={linkBtn}
            >
              查看 / 撰寫評論
            </button>
          </div>

          <div style={{ fontSize: 11, color: "#64748b" }}>
            至少 {minQty}
          </div>

          {/* 數量 + 加入購物袋 */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <input
              type="number"
              min={0}
              step={1}
              value={qty[it.id] || 0}
              onChange={(e) =>
                setQty((m) => ({
                  ...m,
                  [it.id]: Math.max(
                    0,
                    Math.floor(Number(e.target.value || 0))
                  ),
                }))
              }
              style={qtyInput}
            />
            <button onClick={() => addToCart(it)} style={addBtn}>
              加入購物袋
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StallModal({ open, stallId, onClose }) {
  const { uid, isAnonymous, openLoginGate } = usePlayer();
  const [items, setItems] = useState([]);
  const [qty, setQty] = useState({});
  const [reviewItem, setReviewItem] = useState(null); // {id,name}

  // 讀商品：從 /products 讀，依 stallId（或相容舊欄位 category）篩選
  useEffect(() => {
    if (!open || !stallId) return;
    const off = onValue(dbRef(db, "products"), (snap) => {
      const v = snap.val() || {};
      const list = Object.entries(v)
        .map(([id, it]) => ({ id, ...(it || {}) }))
        .filter((p) => String(p.stallId || p.category) === String(stallId));
      list.sort((a, b) => (a.sort || 0) - (b.sort || 0));
      setItems(list);
    });
    return () => off();
  }, [open, stallId]);

  const total = useMemo(
    () =>
      items.reduce((s, it) => {
        const q = Number(qty[it.id] || 0);
        const price = Number(it.priceGroup ?? it.price ?? 0);
        return s + q * price;
      }, 0),
    [items, qty]
  );

  const addToCart = async (it) => {
    if (isAnonymous) return openLoginGate?.();

    const raw = Number(qty[it.id] || 0);
    if (!raw) return;

    // 🔧 自動補到最低下單量
    const minQ = Math.max(1, Number(it.minQty || 1));
    const q = raw < minQ ? minQ : Math.floor(raw);

    const key = `${stallId}|${it.id}`;
    const path = `carts/${uid}/items/${key}`;

    await set(dbRef(db, path), {
      stallId,
      id: it.id,
      name: it.name,
      price: Number(it.priceGroup ?? it.price ?? 0),
      qty: q,
    });
    await update(dbRef(db, `carts/${uid}`), { updatedAt: Date.now() });

    // 輸入框也同步顯示補後的數量
    setQty((m) => ({ ...m, [it.id]: q }));
  };

  if (!open) return null;

  return (
    <div onClick={onClose} style={wrap}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={head}>
          <b>攤位：{stallId}</b>
          <button onClick={onClose} style={xBtn}>
            ×
          </button>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 12 }}>
          {items.length === 0 ? (
            <div style={{ color: "#64748b" }}>目前這個攤位沒有上架商品</div>
          ) : (
            items.map((it) => (
              <StallItemCard
                key={`stall-${stallId}-prod-${it.id}`}
                stallId={stallId}
                it={it}
                qty={qty}
                setQty={setQty}
                addToCart={addToCart}
                onOpenReview={setReviewItem}
              />
            ))
          )}

          {/* 小計 */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              fontWeight: 900,
              paddingTop: 8,
            }}
          >
            本攤位加購小計：{ntd1(total)}
          </div>
        </div>
      </div>

      {/* 評論視窗 */}
      {reviewItem && (
        <ReviewModal
          open
          itemId={reviewItem.id}
          itemName={reviewItem.name}
          onClose={() => setReviewItem(null)}
        />
      )}
    </div>
  );
}

/* --- styles --- */
const wrap = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.45)",
  zIndex: 1200,
  display: "grid",
  placeItems: "center",
  padding: 12,
};
const panel = {
  width: "min(980px,96vw)",
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 16,
  boxShadow: "0 20px 48px rgba(0,0,0,.2)",
  overflow: "hidden",
};
const head = {
  padding: "8px 14px",
  background: "#f9fafb",
  borderBottom: "1px solid #eee",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
const xBtn = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
};
const card = {
  border: "1px solid #f1f5f9",
  borderRadius: 12,
  padding: 10,
  boxShadow: "0 2px 8px rgba(0,0,0,.04)",
};
const qtyInput = {
  width: 80,
  padding: "8px 10px",
  border: "1px solid #ddd",
  borderRadius: 10,
  textAlign: "right",
};
const addBtn = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "2px solid #111",
  background: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};
const linkBtn = {
  marginLeft: 10,
  border: "none",
  background: "transparent",
  color: "rgb(37, 99, 235)",
  cursor: "pointer",
  textDecoration: "underline",
};
