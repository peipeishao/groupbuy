// src/pages/MarketTown.jsx
import React, { useRef, useState, useEffect } from "react";
import Town from "./Town.jsx";
import OrdersSummaryTable from "../components/OrdersSummaryTable.jsx";
import OrderSheetModal from "../components/OrderSheetModal.jsx";
import CartModal from "../components/CartModal.jsx";
import ChatBox from "../components/ChatBox.jsx";
import HUD from "../components/HUD.jsx";

export default function MarketTown() {
  // 商品選單彈窗：null | "chicken" | "canele"
  const [openSheet, setOpenSheet] = useState(null);
  // 購物袋
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState([]); // [{id,name,price,qty,stallId}]

  // 供中央表格滾動容器使用
  const tableWrapRef = useRef(null);
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const h = Math.max(260, window.innerHeight * 0.45);
    el.style.maxHeight = `${h}px`;
  }, []);

  // 加入購物袋（合併數量）
  const addToCart = (item) => {
    setCart((list) => {
      const i = list.findIndex((x) => x.id === item.id && x.stallId === item.stallId);
      if (i >= 0) {
        const n = [...list];
        n[i] = { ...n[i], qty: n[i].qty + item.qty };
        return n;
      }
      return [...list, item];
    });
  };
  const clearCart = () => setCart([]);

  // ====== 背景容器（relative，標題用 absolute 定位） ======
  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        backgroundImage: "url(/bg-town.jpg)", // 換成你的背景圖
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* 這三個標題：絕對定位，可自行調整 top/left */}
      <div style={{
        position: "absolute", left: 120, top: 40,
        color: "white", fontWeight: 900, fontSize: 42, textShadow: "0 2px 10px rgba(0,0,0,.4)"
      }}>
        許願池
      </div>

      <button
        onClick={() => setOpenSheet("chicken")}
        style={{
          position: "absolute", left: 460, top: 70, // ← 想改位置就改這兩個數字
          transform: "translateX(-50%)",
          color: "#7b4f2b", fontWeight: 900, fontSize: 28,
          background: "rgba(255,236,200,.85)", padding: "6px 12px", borderRadius: 10,
          border: "1px solid #e1c8a2", cursor: "pointer"
        }}
      >
        🐔 雞胸肉
      </button>

      <button
        onClick={() => setOpenSheet("canele")}
        style={{
          position: "absolute", left: 810, top: 70, // ← 這裡也可自由調整
          transform: "translateX(-50%)",
          color: "#7b4f2b", fontWeight: 900, fontSize: 28,
          background: "rgba(255,236,200,.85)", padding: "6px 12px", borderRadius: 10,
          border: "1px solid #e1c8a2", cursor: "pointer"
        }}
      >
        🥐 C文可麗露
      </button>

      {/* 中央彙總表（固定位置＋獨立卷軸） */}
      <div
        style={{
          position: "absolute", left: "50%", top: "55%",
          transform: "translate(-50%, -50%)",
          width: 1050, background: "rgba(255,255,255,.92)", borderRadius: 16,
          border: "1px solid #eedbbd", boxShadow: "0 12px 26px rgba(0,0,0,.2)", padding: 12
        }}
      >
        <div ref={tableWrapRef} style={{ overflow: "auto", borderRadius: 12 }}>
          <OrdersSummaryTable />
        </div>
      </div>

      {/* 左下：聊天室（常駐） */}
      <div style={{
        position: "fixed", left: 18, bottom: 18, width: 420, height: 240,
        background: "rgba(255,255,255,.92)", border: "1px solid #eee", borderRadius: 16,
        overflow: "hidden", boxShadow: "0 8px 18px rgba(0,0,0,.18)", zIndex: 50,
        display: "flex", flexDirection: "column"
      }}>
        <ChatBox />
      </div>

      {/* 多人移動層 */}
      <Town />

      {/* 底部 HUD（購物袋按鈕會打開 CartModal） */}
      <HUD onOpenCart={() => setCartOpen(true)} />

      {/* 商品清單彈窗（只負責加入購物袋） */}
      {openSheet && (
        <OrderSheetModal
          stallId={openSheet}
          onClose={() => setOpenSheet(null)}
          onAdd={addToCart}
        />
      )}

      {/* 購物袋彈窗（顯示 + 送單） */}
      {cartOpen && (
        <CartModal
          cart={cart}
          onClose={() => setCartOpen(false)}
          onClear={clearCart}
        />
      )}
    </div>
  );
}
