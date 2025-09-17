// src/components/CartModal.jsx — 去除重複 announce 版本
import React, { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase.js";
import { ref, push, set, get } from "firebase/database"; // 仍需要 push/set/get 建立訂單與操作購物袋
import { usePlayer } from "../store/playerContext.jsx";
import { useCart } from "../store/useCart.js";
import { announce } from "../utils/announce.js"; // ✅ 改用共用的 announce，避免重複宣告

const fmt1 = (n) =>
  new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(n) || 0);

export default function CartModal({ onClose }) {
  const { isAnonymous, openLoginGate, roleName, avatar, uid } = usePlayer();
  const { items = [], reload } = useCart();
  const [placing, setPlacing] = useState(false);

  const total = useMemo(
    () => items.reduce((s, x) => s + (Number(x.price) || 0) * (Number(x.qty) || 0), 0),
    [items]
  );

  // 數量調整
  const changeQty = async (stallId, id, deltaOrValue) => {
    try {
      const me = auth.currentUser?.uid;
      if (!me) return;
      const key = `${stallId}|${id}`;
      const prev = items.find((it) => it.stallId === stallId && it.id === id);
      let nextQty =
        typeof deltaOrValue === "number" && Math.abs(deltaOrValue) < 99
          ? (Number(prev?.qty) || 0) + deltaOrValue
          : Math.max(0, Number(deltaOrValue) || 0);

      if (nextQty <= 0) {
        await set(ref(db, `carts/${me}/items/${key}`), null);
      } else {
        await set(ref(db, `carts/${me}/items/${key}/qty`), nextQty);
      }
      await set(ref(db, `carts/${me}/updatedAt`), Date.now());
      await reload?.();
    } catch (e) {
      console.error("[changeQty] failed", e);
      alert("修改數量失敗，請稍後再試");
    }
  };

  // 刪除
  const removeItem = async (stallId, id) => {
    try {
      const me = auth.currentUser?.uid;
      if (!me) return;
      const key = `${stallId}|${id}`;
      await set(ref(db, `carts/${me}/items/${key}`), null);
      await set(ref(db, `carts/${me}/updatedAt`), Date.now());
      await reload?.();
    } catch (e) {
      console.error("[removeItem] failed", e);
      alert("刪除失敗，請稍後再試");
    }
  };

  // 送單
  const handleCheckout = async () => {
    if (placing || !items.length) return;
    if (isAnonymous) {
      // 需登入後才能送單
      openLoginGate({ to: "login", next: "checkout", resumeAction: () => handleCheckout() });
      return;
    }
    try {
      setPlacing(true);

      // 讀取 realName（playersPrivate/{uid}/realName）
      let realName = "";
      try {
        const snap = await get(ref(db, `playersPrivate/${uid}/realName`));
        realName = String(snap.val() || "");
      } catch {}

      const orderRef = push(ref(db, "orders"));
      const orderItems = items.map((it) => ({
        stallId: it.stallId,
        id: it.id,
        name: it.name,
        price: Number(it.price) || 0,
        qty: Number(it.qty) || 0,
      }));
      const payload = {
        uid,
        orderedBy: {
          uid,
          roleName: roleName || "旅人",
          avatar: myAvatar,
          avatarUrl: myAvatarUrl || null,
          realName: realName || null, // ✅ 寫入真實姓名
        },
        items: orderItems,
        total,
        status: "submitted",
        paid: false,
        paidAt: null,
        last5: null,
        createdAt: Date.now(),
      };
      await set(orderRef, payload);

      // 公告：OOO 送出訂單
      await announce(`${realName || roleName || "有人"}送出了一筆訂單`);

      // 清空購物袋
      if (auth.currentUser) {
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

  // 登入成功 → 自動送單（相容原先流程）
  useEffect(() => {
    const onOk = (e) => {
      if (e?.detail?.next === "checkout") handleCheckout();
    };
    window.addEventListener("login-success", onOk);
    return () => window.removeEventListener("login-success", onOk);
  }, [items, total, uid, roleName, avatar, placing, isAnonymous]);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 160 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(980px,96vw)", background: "#fff", borderRadius: 16, border: "1px solid #eee", boxShadow: "0 20px 48px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid #eee", background: "#f9fafb" }}>
          <h3 style={{ margin: 0 }}>購物袋</h3>
          <button onClick={onClose} aria-label="關閉" style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}>×</button>
        </div>

        <div style={{ padding: 16, overflow: "auto", maxHeight: "68vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#fafafa" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 8, width: 120 }}>攤位</th>
                <th style={{ textAlign: "left", padding: 8 }}>品項</th>
                <th style={{ textAlign: "right", padding: 8, width: 80 }}>單價</th>
                <th style={{ textAlign: "center", padding: 8, width: 140 }}>數量</th>
                <th style={{ textAlign: "right", padding: 8, width: 120 }}>小計</th>
                <th style={{ textAlign: "center", padding: 8, width: 80 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: 12, textAlign: "center", color: "#888" }}>購物袋是空的</td></tr>
              ) : items.map((it) => {
                const sub = (Number(it.price) || 0) * (Number(it.qty) || 0);
                return (
                  <tr key={`${it.stallId}|${it.id}`} style={{ borderTop: "1px solid #f0f0f0" }}>
                    <td style={{ padding: 8 }}>{it.stallId}</td>
                    <td style={{ padding: 8 }}>{it.name}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{fmt1(it.price)}</td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <button type="button" onClick={() => changeQty(it.stallId, it.id, -1)} className="small-btn">−</button>
                        <input
                          value={Number(it.qty) || 0}
                          onChange={(e) => changeQty(it.stallId, it.id, e.target.value)}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          style={{ width: 56, textAlign: "center", border: "1px solid #ddd", borderRadius: 8, padding: "6px 4px" }}
                        />
                        <button type="button" onClick={() => changeQty(it.stallId, it.id, +1)} className="small-btn">＋</button>
                      </div>
                    </td>
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>{fmt1(sub)}</td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <button onClick={() => removeItem(it.stallId, it.id)}
                        style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>
                        移除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 16px 16px" }}>
          <div style={{ color: "#666" }}>共 {items.length} 項</div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>合計 NT$ {fmt1(total)}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "0 16px 16px" }}>
          <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 12 }}>關閉</button>
          <button
            onClick={handleCheckout}
            disabled={placing || items.length === 0}
            style={{ padding: "10px 16px", borderRadius: 12, border: "2px solid #333", background: "#fff", fontWeight: 800, cursor: placing ? "not-allowed" : "pointer" }}
          >
            {placing ? "送出中…" : (isAnonymous ? "先登入再送單" : "送出訂單")}
          </button>
        </div>
      </div>
    </div>
  );
}
