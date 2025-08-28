// src/components/StallCard.jsx
import React from "react";

export default function StallCard({ stall, onOpen }) {
  return (
    <div
      onClick={() => onOpen(stall)}
      style={{
        cursor: "pointer",
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: 16,
        padding: 12,
        boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
      }}
    >
      <img
        src={stall.bannerUrl}
        alt={stall.title}
        style={{
          width: "100%",
          height: 140,
          objectFit: "cover",
          borderRadius: 12,
          marginBottom: 8,
        }}
      />
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{stall.title}</div>
      <div style={{ color: "#666", fontSize: 12 }}>攤主：{stall.owner}</div>
    </div>
  );
}
