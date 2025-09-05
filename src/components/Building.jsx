// src/components/Building.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase.js";
import { ref as dbRef, onValue } from "firebase/database";

/**
 * 用法：
 * <Building title="雞胸小舖" stallId="chicken" onOpen={() => openOrderForm("chicken")} />
 * - 若有傳 stallId：徽章顯示該類別（category === stallId）的商品數
 * - 若未傳 stallId：徽章顯示所有 products 的商品總數
 * - 只改 UI；點擊仍照原本 onOpen 邏輯開你的頁面
 */
export default function Building({ title, onOpen, style, stallId, bg }) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    const r = dbRef(db, "products");
    const off = onValue(
      r,
      (snap) => {
        const v = snap.val() || {};
        const list = Object.values(v);
        const filtered = stallId
          ? list.filter((p) => String(p?.category || "") === String(stallId))
          : list;
        setCount(filtered.length);
      },
      () => setCount(null)
    );
    return () => off();
  }, [stallId]);

  const bgUrl =
    bg ||
    "https://images.unsplash.com/photo-1603640190815-8fde6f40877f?q=80&w=1200&auto=format&fit=crop";

  return (
    <div style={style}>
      {/* 標題 */}
      <div
        style={{
          textAlign: "center",
          color: "#c00",
          fontWeight: 800,
          fontSize: 20,
          textShadow: "0 1px 0 #fff",
        }}
      >
        {title}
      </div>

      {/* 建築卡片 */}
      <div
        onClick={onOpen}
        title="點我開啟團購清單"
        style={{
          position: "relative",
          width: 520,
          height: 260,
          marginTop: 6,
          cursor: "pointer",
          backgroundImage: `url("${bgUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: 18,
          border: "1px solid #e6d6b6",
          boxShadow: "0 8px 24px rgba(0,0,0,.18)",
          overflow: "hidden",
        }}
      >
        {/* 商品數徽章（即時訂閱 products/） */}
        {count !== null && (
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,.9)",
              border: "1px solid #eee",
              fontSize: 12,
              fontWeight: 800,
              boxShadow: "0 6px 16px rgba(0,0,0,.12)",
            }}
          >
            {stallId ? `此攤商品 ${count} 項` : `商品 ${count} 項`}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 6, color: "#666" }}>
        （點建築開清單）
      </div>
    </div>
  );
}
