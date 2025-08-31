// src/components/HUD.jsx
import React from "react";
import { usePlayer } from "../store/playerContext.jsx";

const AVATAR_EMOJI = { bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" };

export default function HUD({ onOpenCart }) {
  const { profile } = usePlayer();
  const name = profile.realName || profile.name || "旅人";
  const coin = profile.coins ?? 0;
  const emoji = AVATAR_EMOJI[profile.avatar || "bunny"] || "🙂";

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
        border: "1px solid #eee", boxShadow: "0 6px 16px rgba(0,0,0,.12)", minWidth: 220
      }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>名字（真實姓名）</div>
        <div style={{ fontSize: 18 }}>{name}</div>
      </div>

      <div style={{
        background: "rgba(255,255,255,.95)", padding: "10px 14px", borderRadius: 12,
        border: "1px solid #eee", boxShadow: "0 6px 16px rgba(0,0,0,.12)"
      }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>金幣</div>
        <div style={{ fontSize: 18 }}>🪙 {coin}</div>
      </div>

      <button onClick={onOpenCart} style={{
        padding: "18px 36px", borderRadius: 14, border: "2px solid #333", background: "#fff",
        boxShadow: "0 8px 22px rgba(0,0,0,.18)", fontWeight: 800, cursor: "pointer"
      }}>
        購物袋
      </button>
    </div>
  );
}
