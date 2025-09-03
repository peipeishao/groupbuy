// src/components/HUD.jsx
import React, { useMemo } from "react";
import { usePlayer } from "../store/playerContext.jsx";
import { useCart } from "../store/useCart.js";
import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";

const AVATAR_EMOJI = { bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" };

export default function HUD({ onOpenCart }) {
  let player = null;
  try { player = usePlayer(); } catch (_) { /* 仍可渲染，僅少功能 */ }

  const { items } = useCart();

  const roleName = player?.roleName || player?.profile?.roleName || "旅人";
  const realName = player?.realName || player?.profile?.realName || "";
  const avatarKey = player?.avatar || player?.profile?.avatar || "bunny";
  const coins = player?.profile?.coins ?? 0;
  const emoji = AVATAR_EMOJI[avatarKey] || "🙂";

  const cartQty = useMemo(() => items.reduce((s, x) => s + (Number(x.qty) || 0), 0), [items]);

  const isAnonymous =
  player?.isAnonymous ??
  ((!auth.currentUser) || !!auth.currentUser?.isAnonymous);

  return (
    <div style={{
      position: "fixed", left: "50%", bottom: 16, transform: "translateX(-50%)",
      display: "flex", alignItems: "center", gap: 20, zIndex: 60
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,.9)",
        display: "grid", placeItems: "center", boxShadow: "0 6px 16px rgba(0,0,0,.15)", border: "1px solid #eee"
      }}>
        <div style={{ fontSize: 36 }}>{emoji}</div>
      </div>

      <div style={{
        background: "rgba(255,255,255,.95)", padding: "10px 14px", borderRadius: 12,
        border: "1px solid #eee", boxShadow: "0 6px 16px rgba(0,0,0,.12)", minWidth: 240
      }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>角色名稱（公開）</div>
        <div style={{ fontSize: 18 }}>{roleName}</div>
        {realName ? <div style={{ marginTop: 6, fontSize: 12, color: "#888" }}>真實姓名（只有你自己看得到）：{realName}</div> : null}
      </div>

      <div style={{
        background: "rgba(255,255,255,.95)", padding: "10px 14px", borderRadius: 12,
        border: "1px solid #eee", boxShadow: "0 6px 16px rgba(0,0,0,.12)"
      }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>金幣</div>
        <div style={{ fontSize: 18 }}>🪙 {coins}</div>
      </div>

      <button
        onClick={onOpenCart}
        style={{
          position: "relative",
          padding: "18px 36px",
          borderRadius: 14,
          border: "2px solid #333",
          background: "#fff",
          boxShadow: "0 8px 22px rgba(0,0,0,.18)",
          fontWeight: 800,
          cursor: "pointer",
          minWidth: 140
        }}
        aria-label={`開啟購物袋，目前共有 ${cartQty} 件`}
      >
        購物袋
        {cartQty > 0 && (
          <span style={{
            position: "absolute", top: -8, right: -8, minWidth: 26, height: 26, padding: "0 8px",
            borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 14, fontWeight: 800,
            display: "grid", placeItems: "center", border: "2px solid #fff", boxShadow: "0 6px 16px rgba(0,0,0,.18)"
          }}>
            {cartQty}
          </span>
        )}
      </button>

      {isAnonymous ? (
        <button
          onClick={() => player?.openLoginGate ? player.openLoginGate({ mode: "upgrade" }) : alert("目前無法開啟登入視窗")}
          style={{ padding: "12px 20px", borderRadius: 14, border: "2px solid #333", background: "#fff", fontWeight: 800, cursor: "pointer" }}
          title="登入或建立帳號（將升級匿名帳號，購物袋無縫保留）"
        >
          登入 / 建立帳號
        </button>
      ) : (
        <>
          <button
            onClick={async () => {
              if (player?.logoutAndGoAnonymous) {
                await player.logoutAndGoAnonymous();
              } else {
                await signOut(auth);
              }
            }}
            style={{ padding: "12px 20px", borderRadius: 14, border: "2px solid #c00", background: "#fff", color: "#c00", fontWeight: 800, cursor: "pointer" }}
            title="登出並回到匿名模式"
          >
            登出
          </button>
          <button
            onClick={async () => {
              if (player?.logoutAndGoAnonymous) {
                await player.logoutAndGoAnonymous();
                setTimeout(() => player?.openLoginGate?.({ mode: "signin" }), 0);
              } else {
                await signOut(auth);
                alert("請重新登入");
              }
            }}
            style={{ padding: "12px 20px", borderRadius: 14, border: "2px solid #333", background: "#fff", fontWeight: 800, cursor: "pointer" }}
            title="以另一個帳號登入"
          >
            切換帳號
          </button>
        </>
      )}
    </div>
  );
}
