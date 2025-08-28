// src/components/MarketHeader.jsx
import React from "react";
import { usePlayer } from "../store/playerContext";

export default function MarketHeader({ onOpenQuests, onOpenWardrobe }) {
  const { profile } = usePlayer();
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        background: "#FFF7E6",
        borderBottom: "1px solid #f2e6d0",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ fontWeight: 700 }}>🐣 溫馨小市集</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span>👤 {profile.name}</span>
        <span>🪙 {profile.coins}</span>
        <button onClick={onOpenWardrobe}>衣櫥</button>
        <button onClick={onOpenQuests}>任務</button>
      </div>
    </header>
  );
}
