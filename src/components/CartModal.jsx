// src/components/CartModal.jsx
import React, { useMemo } from "react";
import { db } from "../firebase.js";
import { push, ref, serverTimestamp } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";

// cart: [{id,name,price,qty,stallId}]
export default function CartModal({ cart = [], onClose, onClear }) {
  const { uid, profile } = usePlayer();

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
        stallId: it.stallId || "unknown",
        itemId: it.id,
        itemName: it.name,
        qty: it.qty,
        total: it.price * it.qty,
        paid: false,
        ts: serverTimestamp(),
      });
    }
    alert("訂單已送出 ✅");
    onClear?.();
    onClose?.();
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 60,
        display: "grid", placeItems: "center"
      }}
    >
      <div style={{
        width: 640, background: "#fff", borderRadius: 16, border: "1px solid #eee",
        boxShadow: "0 16px 36px rgba(0,0,0,.25)", overflow: "hidden"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: 12, borderBottom: "1px solid #eee" }}>
          <strong>🧺 購物袋</strong>
          <button onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: 16 }}>
          {cart.length === 0 ? (
            <div style={{ color: "#777" }}>還沒有加入任何品項</div>
          ) : (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                {cart.map((c, idx) => (
                  <div key={`${c.id}-${idx}`} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>[{c.stallId}] {c.name} × {c.qty}</span>
                    <span>🪙 {c.price * c.qty}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontWeight: 800, textAlign: "right" }}>
                合計：🪙 {total}
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button onClick={onClear} style={{ flex: 1 }}>清空</button>
                <button onClick={submit} style={{ flex: 2, fontWeight: 800 }}>
                  確認送單
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
