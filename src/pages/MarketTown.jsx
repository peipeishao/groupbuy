// src/pages/MarketTown.jsx
import React, { useRef, useState, useEffect } from "react";
import Town from "./Town.jsx";
import OrdersSummaryTable from "../components/OrdersSummaryTable.jsx";
import OrderSheetModal from "../components/OrderSheetModal.jsx";
import CartModal from "../components/CartModal.jsx";
import ChatBox from "../components/ChatBox.jsx";
import HUD from "../components/HUD.jsx";
import LoginGate from "../components/LoginGate.jsx";
import ProductManager from "../components/ProductManager.jsx";
import FullBleedStage, { Pin, PlacardImageButton } from "../components/FullBleedStage.jsx";
import StallModal from "../components/StallModal.jsx";


export default function MarketTown() {
  const [openSheet, setOpenSheet] = useState(null); // null | "chicken" | "cannele"
  const [cartOpen, setCartOpen] = useState(false);
  const [pmOpen, setPmOpen] = useState(false);

  // 你的背景圖（滿版）
  const BG_URL = "/public/bg-town.jpg"; // TODO: 改成你的背景圖原檔（請記下原圖解析度）

  // 門牌座標（以「原圖百分比」定錨，0~100；大小用 widthRel 相對原圖寬度）
  // 請依你的實際建築位置微調 xPct/yPct/widthRel
  const placards = [
    { id: "chicken", label: "金豐盛雞胸肉",    xPct: 47.0, yPct: 12.0, widthRel: 0.10 },
    { id: "cannele", label: "C文可麗露", xPct: 65.0, yPct: 12.0, widthRel: 0.14 },
  ];

  const tableWrapRef = useRef(null);
  useEffect(() => {
    const onResize = () => {
      const el = tableWrapRef.current;
      if (!el) return;
      const vh = window.innerHeight;
      el.style.maxHeight = Math.max(240, Math.min(520, vh - 220)) + "px";
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* ✅ 滿版背景 + 精準釘點（z-index: 1/2） */}
      <FullBleedStage bg={BG_URL} baseWidth={1920} baseHeight={1080}>
        {placards.map((p) => (
           <Pin key={p.id} xPct={p.xPct} yPct={p.yPct} widthRel={p.widthRel}>
    <PlacardImageButton
      img={`/buildings/button-normal.png`}          // 常態圖
      imgHover={`/buildings/button-light.png`}   // 滑過（可省略）
      imgActive={`/buildings/button-dark.png`}  // 按下（可省略）
      label={p.label}                               // 若你的圖上已有字，可拿掉
      onClick={() => setOpenSheet(p.id)}
    />
  </Pin>
        ))}
      </FullBleedStage>

      {/* 角色小鎮層：覆蓋在背景上方（z-index 預設更高） */}
      <div style={{ position: "relative", zIndex: 3 }}>
        <Town />
      </div>

      {/* 訂單表：置底置中 */}
<div
  style={{
    position: "fixed",
    left: "50%",
    bottom: 150,                 // 如會擋到聊天/HUD，可改大一點
    transform: "translateX(-50%)",
    zIndex: 12,                 // 要比背景與 Town 更高
    width: "min(1100px, 96vw)",
  }}
>
  <div style={{
    maxHeight: "min(60vh, 540px)",
    overflow: "auto",
    borderRadius: 12,
    boxShadow: "0 18px 36px rgba(0,0,0,.2)",
    background: "#fff"
  }}>
    <OrdersSummaryTable />
  </div>
</div>


      {/* 聊天室（固定左下） */}
      <div style={{ position: "fixed", left: 18, bottom: 16, zIndex: 15 }}>
        <ChatBox />
      </div>

      {/* HUD（固定右下） */}
      <HUD onOpenCart={() => setCartOpen(true)} />

      {/* 商品清單（攤位） */}
      {openSheet && (
        <OrderSheetModal
          open={!!openSheet}                 // ← 關鍵：傳 open 才會顯示
          stallId={openSheet}                // "chicken" 或 "cannele"
          onClose={() => setOpenSheet(null)} // 關閉
        />
      )}
      {/* 購物袋 */}
      {cartOpen && <CartModal onClose={() => setCartOpen(false)} />}

      {/* 商品管理（僅 admin 可見；此處保留開啟點） */}
      {pmOpen && <ProductManager onClose={() => setPmOpen(false)} />}

      {/* 登入 / 註冊（匿名升級） */}
      <LoginGate />
    </div>
  );
}
