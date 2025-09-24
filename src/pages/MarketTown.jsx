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

  // 攤位按鈕（維持原本）
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

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* 🧭 把兩個「開團時間區塊」移進 FullBleedStage，用 Pin 做百分比定位（相對背景） */}
      <FullBleedStage bg={BG_URL} baseWidth={1920} baseHeight={1080}>
        {/* 吊牌：雞胸肉（例：畫面上方偏左的位置） */}
        <Pin xPct={47} yPct={24} widthRel={0.10}>
          {/* 加個 wrapper 提升層級，避免被背景或其他元素蓋掉 */}
          <div style={{ position: "relative", zIndex: 20 }}>
            <StallStatusSign
              stallId="chicken"
              hideTitle
              rowGap={4}
              rowPaddingY={6}
              labelWidth={88}
              sectionGap={2}
              /* 讓寬度跟著 Pin 的 widthRel 縮放，不再用固定 px */
              style={{ width: "100%" }}
            />
          </div>
        </Pin>

        {/* 吊牌：C文可麗露（例：畫面上方偏右的位置） */}
        <Pin xPct={65} yPct={24} widthRel={0.10}>
          <div style={{ position: "relative", zIndex: 20 }}>
            <StallStatusSign
              stallId="cannele"
              hideTitle
              rowGap={4}
              rowPaddingY={6}
              labelWidth={88}
              sectionGap={2}
              style={{ width: "100%" }}
            />
          </div>
        </Pin>

        {/* 既有的兩顆攤位按鈕（維持原本） */}
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

      {/* 小鎮層（維持原本） */}
      <div style={{ position: "relative", zIndex: 3 }}>
        <Town />
      </div>

      {/* 訂單總覽（維持原本：固定在下方中央） */}
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

      {/* 聊天框（維持原本：固定左下） */}
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

      <AnnouncementDanmaku lanes={4} rowHeight={38} topOffset={80} durationSec={9} />

      <LoginGate />
    </div>
  );
}
