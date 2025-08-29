// src/components/Building.jsx
import React from "react";

export default function Building({ title, onOpen, style }) {
  return (
    <div style={style}>
      {/* 主題橫幅 */}
      <div style={{
        textAlign: "center", color: "#c00", fontWeight: 800, fontSize: 20,
        textShadow: "0 1px 0 #fff"
      }}>
        {title}
      </div>
      {/* 建築圖（先用一張免費背景） */}
      <div
        onClick={onOpen}
        title="點我開啟團購清單"
        style={{
          width: 520, height: 260, marginTop: 6, cursor: "pointer",
          backgroundImage:
            'url("https://images.unsplash.com/photo-1603640190815-8fde6f40877f?q=80&w=1200&auto=format&fit=crop")',
          backgroundSize: "cover", backgroundPosition: "center",
          borderRadius: 18, border: "1px solid #e6d6b6", boxShadow: "0 8px 24px rgba(0,0,0,.18)"
        }}
      />
      <div style={{ textAlign: "center", marginTop: 6, color: "#666" }}>（點建築開清單）</div>
    </div>
  );
}
