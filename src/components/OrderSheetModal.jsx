import React, { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase.js";
import { ref, push, set, serverTimestamp } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";
import { useCart } from "../store/useCart.js";

const fmt = (n) => new Intl.NumberFormat("zh-TW").format(n || 0);

export default function OrderSheetModal({ open, stallId, onClose }) {
  const { isAnonymous, openLoginGate, roleName, avatar, uid } = usePlayer();
  const { items = [], reload, clearCart } = useCart();
  const [placing, setPlacing] = useState(false);

  const cartItems = useMemo(() => {
    if (!stallId) return items;
    return items.filter((it) => it.stallId === stallId);
  }, [items, stallId]);

  const total = useMemo(
    () => cartItems.reduce((s, x) => s + (Number(x.price)||0)*(Number(x.qty)||0), 0),
    [cartItems]
  );

  // ✅ 雙保險：placeOrder 內部也檢查匿名 → 直接開登入窗，不送單
  const placeOrder = async () => {
    if (placing || !cartItems.length) return;
    if (isAnonymous) {
      openLoginGate({ mode: "upgrade", next: "checkout" });
      return;
    }
    try {
      setPlacing(true);
      const orderRef = push(ref(db, "orders"));
      const payload = {
        uid,
        orderedBy: { uid, roleName, avatar },
        items: cartItems.map(({ stallId, id, name, price, qty }) => ({ stallId, id, name, price, qty })),
        total,
        status: "submitted",
        paid: false,
        paidAt: null,
        last5: null,
        createdAt: serverTimestamp(),
      };
      await set(orderRef, payload);

      if (typeof clearCart === "function") {
        await clearCart();
      } else if (auth.currentUser?.uid) {
        await set(ref(db, `carts/${auth.currentUser.uid}`), { items: {}, updatedAt: Date.now() });
      }

      await reload?.();
      onClose?.();
      alert("訂單已送出！");
    } catch (err) {
      console.error(err);
      alert("送單失敗，請稍後再試");
    } finally {
      setPlacing(false);
    }
  };

  useEffect(() => {
    const onOk = (e) => { if (e?.detail?.next === "checkout") placeOrder(); };
    window.addEventListener("login-success", onOk);
    return () => window.removeEventListener("login-success", onOk);
  }, [cartItems, total, uid, roleName, avatar, placing, isAnonymous]);

  const handleCheckoutClick = () => {
    if (isAnonymous) {
      openLoginGate({ mode: "upgrade", next: "checkout" });
      return;
    }
    placeOrder();
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.28)", display: "grid", placeItems: "center", zIndex: 160 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(880px, 96vw)", background: "#fff", borderRadius: 16, padding: 16, position: "relative" }}>
        <button onClick={onClose} aria-label="關閉" style={{ position: "absolute", right: 8, top: 8, borderRadius: 999, width: 36, height: 36 }}>×</button>

        <h3 style={{ marginTop: 4, marginBottom: 12, fontWeight: 900 }}>
          攤位：{stallId || "全部"}　|　購物清單
        </h3>

        <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#fafafa" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 8 }}>品項</th>
                <th style={{ textAlign: "right", padding: 8, width: 80 }}>單價</th>
                <th style={{ textAlign: "right", padding: 8, width: 80 }}>數量</th>
                <th style={{ textAlign: "right", padding: 8, width: 120 }}>小計</th>
              </tr>
            </thead>
            <tbody>
              {cartItems.length === 0 ? (
                <tr><td colSpan="4" style={{ padding: 12, textAlign: "center", color: "#888" }}>這個攤位目前沒有品項</td></tr>
              ) : cartItems.map((it) => {
                const sub = (Number(it.price)||0) * (Number(it.qty)||0);
                return (
                  <tr key={`${it.stallId}|${it.id}`} style={{ borderTop: "1px solid #f0f0f0" }}>
                    <td style={{ padding: 8 }}>{it.name}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{fmt(it.price)}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{it.qty}</td>
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>{fmt(sub)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <div style={{ color: "#666" }}>共 {cartItems.length} 項</div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>合計 NT$ {fmt(total)}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 12 }}>關閉</button>
          <button
            onClick={handleCheckoutClick}
            disabled={placing || cartItems.length === 0}
            style={{ padding: "10px 16px", borderRadius: 12, border: "2px solid #333", background: "#fff", fontWeight: 800, cursor: placing ? "not-allowed" : "pointer" }}
            title={isAnonymous ? "請先登入 / 建立帳號再送單" : "送出訂單"}
          >
            {placing ? "送出中…" : (isAnonymous ? "先登入再送單" : "送出訂單")}
          </button>
        </div>
      </div>
    </div>
  );
}
