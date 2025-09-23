// src/pages/MarketTown.jsx
import React, { useState, useEffect } from "react";
import Town from "./Town.jsx";
import OrdersSummaryTable from "../components/OrdersSummaryTable.jsx";
import OrderSheetModal from "../components/OrderSheetModal.jsx";
import CartModal from "../components/CartModal.jsx";
import ChatBox from "../components/ChatBox.jsx";
import HUD from "../components/HUD.jsx";
import LoginGate from "../components/LoginGate.jsx";
import ProductManager from "../components/ProductManager.jsx";
import FullBleedStage, { Pin, PlacardImageButton } from "../components/FullBleedStage.jsx";
import AnnouncementDanmaku from "../components/AnnouncementDanmaku.jsx";
import { announce } from "../utils/announce.js";
import { auth } from "../firebase.js";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import StallStatusSign from "../components/StallStatusSign.jsx"; // NEW

export default function MarketTown() {
  const [openSheet, setOpenSheet] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [pmOpen, setPmOpen] = useState(false);

  const BG_URL = "/bg-town.jpg";

  const placards = [
    { id: "chicken", label: "金豐盛雞胸肉", xPct: 47.0, yPct: 12.0, widthRel: 0.10 },
    { id: "cannele", label: "C文可麗露",     xPct: 65.0, yPct: 12.0, widthRel: 0.14 },
  ];

  useEffect(() => {
    let unsub = () => {};
    unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          await signInAnonymously(auth);
          return;
        }
        announce("歡迎旅人進入小鎮");
        unsub && unsub();
      } catch (e) {
        console.warn("[MarketTown] welcome announce failed:", e);
        unsub && unsub();
      }
    });
    return () => { try { unsub && unsub(); } catch {} };
  }, []);

  // 各自可調位置: 直接改下面 style
  const signStyleChicken = {
    position: "fixed",
    left: 800,
    top:80,
    zIndex: 20,
    width: "min(220px, 44vw)",
  };
  const signStyleCannele = {
    position: "fixed",
    right: 560,
    top: 80,
    zIndex: 20,
    width: "min(220px, 44vw)",
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* 左上: 雞胸肉 */}
      <StallStatusSign stallId="chicken" style={signStyleChicken} hideTitle
      rowGap={4}          // 三列彼此距離（預設 6）
      rowPaddingY={6}     // 每列上下內距（預設 4）
      labelWidth={88}     // 左欄寬（預設 96）
      sectionGap={2}     // 吊牌與資訊區塊距離（預設 10）
      />

      {/* 右上: C文可麗露 */}
      <StallStatusSign stallId="cannele" style={signStyleCannele} hideTitle
      rowGap={4}          // 三列彼此距離（預設 6）
      rowPaddingY={6}     // 每列上下內距（預設 4）
      labelWidth={88}     // 左欄寬（預設 96）
      sectionGap={2}     // 吊牌與資訊區塊距離（預設 10）
      /> 

      <FullBleedStage bg={BG_URL} baseWidth={1920} baseHeight={1080}>
        {placards.map((p) => (
          <Pin key={p.id} xPct={p.xPct} yPct={p.yPct} widthRel={p.widthRel}>
            <PlacardImageButton
              img={"/buildings/button-normal.png"}
              imgHover={"/buildings/button-light.png"}
              imgActive={"/buildings/button-dark.png"}
              label={p.label}
              onClick={() => setOpenSheet(p.id)}
            />
          </Pin>
        ))}
      </FullBleedStage>

      <div style={{ position: "relative", zIndex: 3 }}>
        <Town />
      </div>

      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: 150,
          transform: "translateX(-50%)",
          zIndex: 12,
          width: "min(1100px, 96vw)",
        }}
      >
        <div
          style={{
            maxHeight: "min(60vh, 540px)",
            overflow: "auto",
            borderRadius: 12,
            boxShadow: "0 18px 36px rgba(0,0,0,.2)",
            background: "#fff",
          }}
        >
          <OrdersSummaryTable fixedWidth="900px" fixedHeight="400px" />
        </div>
      </div>

      <div style={{ position: "fixed", left: 18, bottom: 16, zIndex: 15 }}>
        <ChatBox />
      </div>

      <HUD onOpenCart={() => setCartOpen(true)} />

      {openSheet && (
        <OrderSheetModal
          open={!!openSheet}
          stallId={openSheet}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {cartOpen && <CartModal onClose={() => setCartOpen(false)} />}

      {pmOpen && <ProductManager onClose={() => setPmOpen(false)} />}

      <AnnouncementDanmaku
        lanes={4}
        rowHeight={38}
        topOffset={80}
        durationSec={9}
      />

      <LoginGate />
    </div>
  );
}
