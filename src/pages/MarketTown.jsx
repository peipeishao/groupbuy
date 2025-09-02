// src/pages/MarketTown.jsx
import React, { useRef, useState, useEffect } from "react";
import Town from "./Town.jsx";
import OrdersSummaryTable from "../components/OrdersSummaryTable.jsx";
import OrderSheetModal from "../components/OrderSheetModal.jsx";
import CartModal from "../components/CartModal.jsx";
import ChatBox from "../components/ChatBox.jsx";
import HUD from "../components/HUD.jsx";

export default function MarketTown() {
  // 商品選單彈窗：null | "chicken" | "cannele"
  const [openSheet, setOpenSheet] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  // 中央表格容器高度
  const tableWrapRef = useRef(null);
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const h = Math.max(260, Math.floor(window.innerHeight * 0.45));
    el.style.maxHeight = `${h}px`;
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        backgroundImage: "url(/bg-town.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* 示意標題 */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 40,
          color: "white",
          fontWeight: 900,
          fontSize: 42,
          textShadow: "0 2px 10px rgba(0,0,0,.4)",
          zIndex: 5,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        許願池
      </div>

      {/* === 建築圖片：點擊開啟攤位清單 === */}
      <img
        src="/buildings/chicken.png"
        alt="雞胸肉攤位"
        onClick={() => setOpenSheet("chicken")}
        style={{
          position: "absolute",
          left: 420,
          top: 140,
          width: 160,
          cursor: "pointer",
          userSelect: "none",
          zIndex: 10,
        }}
        draggable={false}
      />

      <img
        src="/buildings/cannele.png"
        alt="可麗露攤位"
        onClick={() => setOpenSheet("cannele")}
        style={{
          position: "absolute",
          left: 760,
          top: 150,
          width: 160,
          cursor: "pointer",
          userSelect: "none",
          zIndex: 10,
        }}
        draggable={false}
      />

      {/* 中央訂單彙總表 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "55%",
          transform: "translate(-50%, -50%)",
          width: 1050,
          background: "rgba(255,255,255,.92)",
          borderRadius: 16,
          border: "1px solid #eedbbd",
          boxShadow: "0 12px 26px rgba(0,0,0,.2)",
          padding: 12,
          zIndex: 5,
        }}
      >
        <div ref={tableWrapRef} style={{ overflow: "auto", borderRadius: 12 }}>
          <OrdersSummaryTable />
        </div>
      </div>

      {/* 左下：聊天室（常駐） */}
      <div
        style={{
          position: "fixed",
          left: 18,
          bottom: 18,
          width: 420,
          height: 240,
          background: "rgba(255,255,255,.92)",
          border: "1px solid #eee",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 8px 18px rgba(0,0,0,.18)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ChatBox />
      </div>

      {/* 多人移動層 */}
      <Town />

      {/* 底部 HUD（購物袋按鈕會打開 CartModal） */}
      <HUD onOpenCart={() => setCartOpen(true)} />

      {/* 商品清單彈窗 */}
      {openSheet && (
        <OrderSheetModal
          open={!!openSheet}
          stallId={openSheet}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {/* 購物袋彈窗 */}
      {cartOpen && <CartModal onClose={() => setCartOpen(false)} />}
    </div>
  );
}
