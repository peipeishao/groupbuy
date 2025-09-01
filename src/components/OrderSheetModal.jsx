// src/components/OrderSheetModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { onValue, ref } from "firebase/database";
import { useCart } from "../store/useCart.js";

// 若暫時沒有放到 Firebase，可用這個後備清單（請換成你的實際資料）
const FALLBACK_ITEMS = {
  chicken: [
    { id: "ck-200g", name: "雞胸肉 200g", price: 45, stallId: "chicken" },
    { id: "ck-250g", name: "雞胸肉 250g", price: 55, stallId: "chicken" },
  ],
  cannele: [
    { id: "cnl-ori", name: "可麗露 原味", price: 60, stallId: "cannele" },
    { id: "cnl-choco", name: "可麗露 可可", price: 65, stallId: "cannele" },
  ],
};

export default function OrderSheetModal({ open, stallId, onClose }) {
  const { addToCart } = useCart();
  const [items, setItems] = useState([]);
  const [qtyMap, setQtyMap] = useState({});
  const [addedMap, setAddedMap] = useState({}); // 顯示「已加入！」的小提示

  // 載入該攤位商品
  useEffect(() => {
    if (!open || !stallId) return;
    // 1) 嘗試從 Firebase 讀取 /stalls/{stallId}/items
    const itemsRef = ref(db, `stalls/${stallId}/items`);
    const off = onValue(
      itemsRef,
      (snap) => {
        const v = snap.val();
        if (v && typeof v === "object") {
          const arr = Object.entries(v).map(([id, it]) => ({
            id,
            stallId,
            name: it.name,
            price: Number(it.price || 0),
          }));
          setItems(arr);
          setQtyMap(Object.fromEntries(arr.map((it) => [it.id, 0])));
        } else {
          // 2) 若 DB 沒資料 → 使用後備清單
          const arr = (FALLBACK_ITEMS[stallId] || []).map((it) => ({
            ...it,
            stallId,
          }));
          setItems(arr);
          setQtyMap(Object.fromEntries(arr.map((it) => [it.id, 0])));
        }
      },
      { onlyOnce: true }
    );
    return () => off && off();
  }, [open, stallId]);

  const title = useMemo(() => {
    if (stallId === "chicken") return "🍗 雞胸肉";
    if (stallId === "cannele") return "🍮 C文可麗露";
    return "商品清單";
  }, [stallId]);

  const changeQty = (id, delta) => {
    setQtyMap((m) => {
      const next = Math.max(0, (m[id] || 0) + delta);
      return { ...m, [id]: next };
    });
  };

  const addItem = async (it) => {
    const qty = qtyMap[it.id] || 0;
    if (qty <= 0) return;

    // 直接寫入 Firebase /carts/{uid} 透過 useCart()
    await addToCart({ ...it, qty });

    // 小提示：已加入！
    setAddedMap((m) => ({ ...m, [it.id]: true }));
    setTimeout(() => {
      setAddedMap((m) => {
        const n = { ...m };
        delete n[it.id];
        return n;
      });
    }, 1200);

    // 加完清空該品項數量（也可以改成不清空）
    setQtyMap((m) => ({ ...m, [it.id]: 0 }));
  };

  if (!open) return null;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        zIndex: 80,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: 680,
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #eee",
          boxShadow: "0 16px 36px rgba(0,0,0,.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: 12,
            borderBottom: "1px solid #eee",
          }}
        >
          <strong>{title}</strong>
          <button onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 12 }}>
          {items.length === 0 ? (
            <div style={{ color: "#777" }}>這個攤位目前沒有上架商品</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((it) => {
                const qty = qtyMap[it.id] || 0;
                const added = !!addedMap[it.id];
                return (
                  <div
                    key={it.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto auto",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 6px",
                      border: "1px solid #f2f2f2",
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{it.name}</div>
                      <div style={{ color: "#888" }}>🪙 {it.price}</div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => changeQty(it.id, -1)}>-</button>
                      <input
                        value={qty}
                        onChange={(e) =>
                          setQtyMap((m) => ({
                            ...m,
                            [it.id]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        style={{
                          width: 48,
                          textAlign: "center",
                          padding: "6px 4px",
                          border: "1px solid #ddd",
                          borderRadius: 8,
                        }}
                      />
                      <button onClick={() => changeQty(it.id, +1)}>+</button>
                    </div>

                    <button
                      onClick={() => addItem(it)}
                      style={{
                        padding: "8px 10px",
                        fontWeight: 700,
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        background: "#f8fafc",
                      }}
                      disabled={qty <= 0}
                      title={qty <= 0 ? "請先選擇數量" : "加入購物袋"}
                    >
                      加入購物袋
                    </button>

                    <div style={{ minWidth: 72, textAlign: "right", color: added ? "#16a34a" : "#999" }}>
                      {added ? "已加入！" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: 12, borderTop: "1px solid #eee", textAlign: "right", color: "#666" }}>
          選擇數量後點「加入購物袋」，品項會直接進入下方 HUD 的購物袋清單
        </div>
      </div>
    </div>
  );
}
