// src/pages/Market.jsx
import React, { useState } from "react";
import MarketHeader from "../components/MarketHeader";
import StallGrid from "../components/StallGrid";
import ReviewBox from "../components/ReviewBox";
import Wardrobe from "../components/Wardrobe";
import ChatBox from "../components/ChatBox"; // 你既有的

export default function Market() {
  const [showWardrobe, setShowWardrobe] = useState(false);
  const [showQuests, setShowQuests] = useState(false);

  return (
    <div style={{ background: "#FFFDF8", minHeight: "100vh" }}>
      <MarketHeader
        onOpenWardrobe={() => setShowWardrobe((v) => !v)}
        onOpenQuests={() => setShowQuests((v) => !v)}
      />

      {/* 市集與評論（評論先固定對某攤位，之後可跟著詳頁變動） */}
      <StallGrid />
      <div style={{ padding: 16 }}>
        <h3>留下評論（示範：點心攤）</h3>
        <ReviewBox stallId="bakery" />
      </div>

      {/* 衣櫥：簡單切換顯示 */}
      {showWardrobe && (
        <div
          style={{
            position: "fixed",
            inset: "10% 5% auto 5%",
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 16,
            boxShadow: "0 10px 24px rgba(0,0,0,0.15)",
            zIndex: 20,
            maxHeight: "80vh",
            overflow: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", padding: 12 }}>
            <strong>衣櫥</strong>
            <button onClick={() => setShowWardrobe(false)}>關閉</button>
          </div>
          <Wardrobe />
        </div>
      )}

      {/* 任務面板（MVP 先提示三個任務） */}
      {showQuests && (
        <div
          style={{
            position: "fixed",
            right: 16,
            top: 72,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 16,
            padding: 12,
            width: 280,
            zIndex: 20,
            boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>任務</strong>
            <button onClick={() => setShowQuests(false)}>✕</button>
          </div>
          <ol style={{ marginTop: 8, paddingLeft: 18 }}>
            <li>第一次購買 +20 金幣</li>
            <li>今日在聊天室發 1 則訊息 +5 金幣</li>
            <li>今日留下 1 則評論 +10 金幣</li>
          </ol>
          <p style={{ color: "#777", fontSize: 12, marginTop: 8 }}>
            ✅ 成就會自動判定：結帳、發送訊息、送出評論時會加金幣
          </p>
        </div>
      )}

      {/* 右下角聊天室 */}
      <div style={{ position: "fixed", right: 16, bottom: 320, width: 320 }}>
        <ChatBox />
      </div>
    </div>
  );
}
