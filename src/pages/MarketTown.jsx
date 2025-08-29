// src/pages/MarketTown.jsx
import React, { useState } from "react";
import Town from "./Town.jsx";                        // 你已有（多人移動＋氣泡）
import Building from "../components/Building.jsx";    // 新增
import OrderSheetModal from "../components/OrderSheetModal.jsx"; // 新增
import OrdersSummaryTable from "../components/OrdersSummaryTable.jsx"; // 新增
import ChatBox from "../components/ChatBox.jsx";      // 你原本有

export default function MarketTown() {
  const [openSheet, setOpenSheet] = useState(false);
  const [chatOpen, setChatOpen]   = useState(false);

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#f7ebce" }}>
      {/* 背景小鎮（含角色、WASD、氣泡） */}
      <Town />

      {/* 建築：點擊打開團購清單 */}
      <Building
        title="今天的G胸肉對決！"
        onOpen={() => setOpenSheet(true)}
        style={{ position: "absolute", left: "50%", top: 90, transform: "translateX(-50%)" }}
      />

      {/* 中央即時彙總表 */}
      <div style={{ position: "absolute", left: "50%", bottom: 24, transform: "translateX(-50%)" }}>
        <OrdersSummaryTable />
      </div>

      {/* 訂單面板（抽屜/彈窗） */}
      {openSheet && (
        <OrderSheetModal onClose={() => setOpenSheet(false)} stallId="bakery" />
      )}

      {/* 右下角聊天室：浮動按鈕 + 視窗 */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          style={{
            position: "fixed", right: 16, bottom: 16, width: 56, height: 56, borderRadius: "50%",
            background: "#ffcc66", border: "none", boxShadow: "0 6px 16px rgba(0,0,0,.2)", fontSize: 24
          }}
        >💬</button>
      )}
      {chatOpen && (
        <div style={{
          position: "fixed", right: 16, bottom: 16, width: 340, height: 420,
          background: "#fff", border: "1px solid #eee", borderRadius: 14, overflow: "hidden",
          boxShadow: "0 10px 22px rgba(0,0,0,.18)", zIndex: 30
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 8, borderBottom: "1px solid #eee" }}>
            <strong>聊天室</strong>
            <button onClick={() => setChatOpen(false)}>✕</button>
          </div>
          <ChatBox />
        </div>
      )}
    </div>
  );
}
