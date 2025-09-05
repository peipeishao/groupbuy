// src/pages/MarketTown.jsx
import React, { useRef, useState, useEffect } from "react";
import Town from "./Town.jsx";
import OrdersSummaryTable from "../components/OrdersSummaryTable.jsx";
import OrderSheetModal from "../components/OrderSheetModal.jsx";
import CartModal from "../components/CartModal.jsx";
import ChatBox from "../components/ChatBox.jsx";
import HUD from "../components/HUD.jsx";
import LoginGate from "../components/LoginGate.jsx";
import ProductManager from "../components/ProductManager.jsx"; // ✅ 新增：商品管理頁
import OrderHistoryFab from "../components/OrderHistoryFab.jsx";

export default function MarketTown() {
  const [openSheet, setOpenSheet] = useState(null); // null | "chicken" | "cannele"
  const [cartOpen, setCartOpen] = useState(false);
  const [pmOpen, setPmOpen] = useState(false); // ✅ 商品管理視窗

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

      {/* 攤位：雞胸肉 */}
      <img
        src="/buildings/chicken.png"
        alt="雞胸肉攤位"
        onClick={() => setOpenSheet("chicken")}
        style={{
          position: "absolute",
          left: 800,
          top: 10,
          width: 200,
          cursor: "pointer",
          userSelect: "none",
          zIndex: 10,
        }}
        draggable={false}
      />

      {/* 攤位：可麗露 */}
      <img
        src="/buildings/cannele.png"
        alt="可麗露攤位"
        onClick={() => setOpenSheet("cannele")}
        style={{
          position: "absolute",
          left: 1090,
          top: 10,
          width: 280,
          cursor: "pointer",
          userSelect: "none",
          zIndex: 10,
        }}
        draggable={false}
      />

      {/* 中央訂單表 */}
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
          <OrderHistoryFab />
        </div>
      </div>

      {/* 聊天室 */}
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

      {/* 小鎮角色同步 */}
      <Town />

      {/* HUD：含購物袋 + 商品管理入口（admin 才會看到） */}
      <HUD
        onOpenCart={() => setCartOpen(true)}
        onOpenProductManager={() => setPmOpen(true)}
      />

      {/* 攤位訂購表單 */}
      {openSheet && (
        <OrderSheetModal
          open={!!openSheet}
          stallId={openSheet}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {/* 購物袋 */}
      {cartOpen && <CartModal onClose={() => setCartOpen(false)} />}

      {/* 商品管理（僅 admin 可見） */}
      {pmOpen && <ProductManager onClose={() => setPmOpen(false)} />}

      {/* 登入 / 註冊（匿名升級） */}
      <LoginGate />
    </div>
  );
}
