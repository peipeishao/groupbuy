// src/components/CartModal.jsx
import React, { useMemo } from "react";
import { db } from "../firebase.js";
import { push, ref, serverTimestamp } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";
import { useCart } from "../store/useCart.js"; // ✅ 改為在元件內部讀購物袋

export default function CartModal({ onClose }) {
  const player = usePlayer();
  const { items, clearCart } = useCart(); // ✅ 從 Firebase carts/{uid} 取得資料

  // 新舊 context 相容：優先 roleName，否則退回 profile.name
  const uid = player?.uid || "dev-local";
  const roleName = player?.roleName || player?.profile?.name || "旅人";

  const { total, itemCount } = useMemo(() => {
    const t = (items || []).reduce(
      (s, x) => s + (Number(x.price) || 0) * (Number(x.qty) || 0),
      0
    );
    const c = (items || []).reduce((s, x) => s + (Number(x.qty) || 0), 0);
    return { total: t, itemCount: c };
  }, [items]);

  const submit = async () => {
    if (!items?.length || itemCount === 0) return;

    // 目前沿用「每個品項一筆訂單」
    for (const it of items) {
      const qty = Number(it.qty) || 0;
      if (qty <= 0) continue;
      await push(ref(db, "orders"), {
        uid,
        orderedBy: { uid, roleName }, // ✅ 公開顯示用角色名稱
        stallId: it.stallId || "unknown",
        itemId: it.id,
        itemName: it.name,
        qty,
        total: (Number(it.price) || 0) * qty,
        paid: false,
        ts: serverTimestamp(), // RTDB 毫秒時間戳
      });
    }

    alert("訂單已送出 ✅");
    await clearCart(); // ✅ 送單後清空購物袋（Firebase）
    onClose?.();
  };

  const handleClear = async () => {
    await clearCart();
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
        {/* 標頭：顯示總件數＆總金額 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: 12, borderBottom: "1px solid #eee"
        }}>
          <strong>
            🧺 購物袋（共 {itemCount} 件 / 🪙 {total}）
          </strong>
          <button onClick={onClose} aria-label="關閉購物袋">✕</button>
        </div>

        <div style={{ padding: 16 }}>
          {!items?.length || itemCount === 0 ? (
            <div style={{ color: "#777" }}>還沒有加入任何品項</div>
          ) : (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                {items.map((c, idx) => {
                  const qty = Number(c.qty) || 0;
                  if (qty <= 0) return null;
                  const lineTotal = (Number(c.price) || 0) * qty;
                  return (
                    <div key={`${c.stallId}|${c.id}|${idx}`} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>[{c.stallId}] {c.name} × {qty}</span>
                      <span>🪙 {lineTotal}</span>
                    </div>
                  );
                })}
              </div>

              {/* 仍保留底部合計，與標頭一致 */}
              <div style={{ marginTop: 12, fontWeight: 800, textAlign: "right" }}>
                合計：🪙 {total}
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button onClick={handleClear} style={{ flex: 1 }}>清空</button>
                <button
                  onClick={submit}
                  style={{ flex: 2, fontWeight: 800 }}
                  disabled={itemCount === 0}
                  title={itemCount === 0 ? "購物袋是空的" : `以「${roleName}」送單`}
                >
                  確認送單（{roleName}）
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
