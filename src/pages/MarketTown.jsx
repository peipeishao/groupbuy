// src/pages/MarketTown.jsx
import React, { useRef, useState, useEffect } from "react";
import Town from "./Town.jsx";
import OrdersSummaryTable from "../components/OrdersSummaryTable.jsx";
import OrderSheetModal from "../components/OrderSheetModal.jsx";
import CartModal from "../components/CartModal.jsx";
import ChatBox from "../components/ChatBox.jsx";
import HUD from "../components/HUD.jsx";
import LoginGate from "../components/LoginGate.jsx";

export default function MarketTown() {
  const [openSheet, setOpenSheet] = useState(null); // null | "chicken" | "cannele"
  const [cartOpen, setCartOpen] = useState(false);

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

      <img
        src="/buildings/chicken.png"
        alt="雞胸肉攤位"
        onClick={() => setOpenSheet("chicken")}
        style={{ position: "absolute", left: 420, top: 140, width: 160, cursor: "pointer", userSelect: "none", zIndex: 10 }}
        draggable={false}
      />
      <img
        src="/buildings/cannele.png"
        alt="可麗露攤位"
        onClick={() => setOpenSheet("cannele")}
        style={{ position: "absolute", left: 760, top: 150, width: 160, cursor: "pointer", userSelect: "none", zIndex: 10 }}
        draggable={false}
      />

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

      {/* 僅已登入者會出現在 playersPublic */}
      <Town />

      <HUD onOpenCart={() => setCartOpen(true)} />

      {openSheet && (
        <OrderSheetModal
          open={!!openSheet}
          stallId={openSheet}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {cartOpen && <CartModal onClose={() => setCartOpen(false)} />}

      {/* 登入 / 註冊（匿名升級） */}
      <LoginGate />
    </div>
  );
}
