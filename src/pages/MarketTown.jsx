// src/pages/MarketTown.jsx — Danmaku 版（可直接覆蓋）
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



export default function MarketTown() {
  const [openSheet, setOpenSheet] = useState(null); // null | "chicken" | "cannele"
  const [cartOpen, setCartOpen] = useState(false);
  const [pmOpen, setPmOpen] = useState(false);

  // 滿版背景圖
  const BG_URL = "/bg-town.jpg";

  // 建築釘點（依實際位置調整）
  const placards = [
    { id: "chicken", label: "金豐盛雞胸肉", xPct: 47.0, yPct: 12.0, widthRel: 0.10 },
    { id: "cannele", label: "C文可麗露",     xPct: 65.0, yPct: 12.0, widthRel: 0.14 },
  ];

  // 首次進站：等到有 auth（含匿名）才發公告，避免規則擋寫入
  useEffect(() => {
    let unsub = () => {};
    unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          await signInAnonymously(auth);
          return; // 等下一次觸發再 announce
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
      {/* ✅ 滿版背景 + 釘點 */}
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

      {/* 角色小鎮層 */}
      <div style={{ position: "relative", zIndex: 3 }}>
        <Town />
      </div>

      {/* 中央訂單表 */}
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
          <OrdersSummaryTable />
        </div>
      </div>

      {/* 聊天室（左下） */}
      <div style={{ position: "fixed", left: 18, bottom: 16, zIndex: 15 }}>
        <ChatBox />
      </div>

      {/* HUD（右下） */}
      <HUD onOpenCart={() => setCartOpen(true)} />
    

      {/* 商品清單（攤位） */}
      {openSheet && (
        <OrderSheetModal
          open={!!openSheet}
          stallId={openSheet}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {/* 購物袋 */}
      {cartOpen && <CartModal onClose={() => setCartOpen(false)} />}

      {/* 商品管理（保留既有入口控制） */}
      {pmOpen && <ProductManager onClose={() => setPmOpen(false)} />}

      {/* 🔔 彈幕公告（右上 → 左邊平移消失） */}
      <AnnouncementDanmaku
        lanes={4}        // 跑道數（同時可見幾條）
        rowHeight={38}   // 跑道間距（px）
        topOffset={80}   // 第一條跑道距頂端距離（px）
        durationSec={9}  // 飛行時間（秒）
      />

      {/* 登入 / 註冊 */}
      <LoginGate />
    </div>
  );
}
