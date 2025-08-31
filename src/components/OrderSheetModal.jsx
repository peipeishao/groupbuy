// src/components/OrderSheetModal.jsx
import React, { useMemo, useState } from "react";
import { ref, push, serverTimestamp } from "firebase/database";
import { db } from "../firebase.js";
import { usePlayer } from "../store/playerContext.jsx";

// 1) 你定義的攤位品項
const ITEM_SETS = {
  chicken: [
    { id: "A",  name: "經典青蔥椒鹽胸(A)", price: 65 },
    { id: "B",  name: "經典香草嫩雞胸(B)", price: 85 },
    { id: "C",  name: "經典蒜香油嫩雞胸(C)", price: 95 },
    { id: "D",  name: "經典椒麻嫩雞胸(D)", price: 99 },
    { id: "E",  name: "經典鹽麴嫩雞胸(E)", price: 109 },
  ],
  canele: [
    { id: "C1", name: "原味可麗露", price: 55 },
    { id: "C2", name: "焦糖可麗露", price: 65 },
    { id: "C3", name: "抹茶可麗露", price: 65 },
  ],
};

// 2) 後備（未知攤位時使用）
const DEMO_ITEMS = [
  { id: "X1", name: "示範商品 1", price: 50 },
  { id: "X2", name: "示範商品 2", price: 80 },
];

export default function OrderSheetModal({ onClose, stallId = "chicken" }) {
  const [cart, setCart] = useState([]); // {id, name, price, qty}
  const { uid, profile } = usePlayer();

  // 依攤位決定要顯示的商品清單
  const items = useMemo(
    () => ITEM_SETS[stallId] ?? DEMO_ITEMS,
    [stallId]
  );

  const add = (item) => {
    setCart((c) => {
      const i = c.findIndex((x) => x.id === item.id);
      if (i >= 0) {
        const n = [...c];
        n[i] = { ...n[i], qty: n[i].qty + 1 };
        return n;
      }
      return [...c, { ...item, qty: 1 }];
    });
  };

  const total = useMemo(
    () => cart.reduce((s, x) => s + x.price * x.qty, 0),
    [cart]
  );

  const submit = async () => {
    if (!cart.length) return;
    for (const it of cart) {
      await push(ref(db, "orders"), {
        playerId: uid || "dev-local",
        name: profile.name || "旅人",
        stallId,
        itemId: it.id,
        itemName: it.name,
        qty: it.qty,
        total: it.price * it.qty,
        paid: false,
        ts: serverTimestamp(),
      });
    }
    alert("已送出訂單 ✅");
    onClose?.();
  };

  return (
    <div
      id="order-modal-root"
      onClick={(e) => e.target === e.currentTarget && onClose?.()} // 點遮罩關閉
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.3)",
        zIndex: 40,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: 900,
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
          <strong>
            選購清單（{stallId === "chicken" ? "雞胸肉" : stallId === "canele" ? "可麗露" : "示範"}）
          </strong>
          <button onClick={onClose}>✕</button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 16,
            padding: 16,
          }}
        >
          {/* 商品清單 */}
          <div>
            <table width="100%" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fff7e6" }}>
                  <th align="left" style={{ padding: 8 }}>
                    品項
                  </th>
                  <th align="right" style={{ padding: 8 }}>
                    單價
                  </th>
                  <th style={{ padding: 8 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                    <td style={{ padding: 8 }}>{it.name}</td>
                    <td style={{ padding: 8 }} align="right">
                      🪙 {it.price}
                    </td>
                    <td style={{ padding: 8 }} align="center">
                      <button onClick={() => add(it)}>加入</button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: 12, color: "#777" }}>
                      目前沒有可選項目
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 購物袋 */}
          <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>🧺 購物袋</div>
            {cart.length === 0 ? (
              <div style={{ color: "#777" }}>目前沒有商品</div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 6 }}>
                  {cart.map((c) => (
                    <div
                      key={c.id}
                      style={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <span>
                        {c.name} × {c.qty}
                      </span>
                      <span>🪙 {c.price * c.qty}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontWeight: 700 }}>
                  合計：🪙 {total}
                </div>
                <button onClick={submit} style={{ marginTop: 8, width: "100%" }}>
                  送出訂單
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

