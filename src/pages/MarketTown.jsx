// src/pages/MarketTown.jsx（只示範新增/修改的部分）
import React, { useEffect, useRef, useState } from "react";
import Town from "./Town.jsx";
import Building from "../components/Building.jsx";
import OrderSheetModal from "../components/OrderSheetModal.jsx";
import OrdersSummaryTable from "../components/OrdersSummaryTable.jsx";
import ChatBox from "../components/ChatBox.jsx";

export default function MarketTown() {
  const [openSheet, setOpenSheet] = useState(false);
  const [chatOpen, setChatOpen]   = useState(false);
  const bannerRef   = useRef(null);
  const buildingRef = useRef(null);
  const tableRef    = useRef(null);

  const [obstacles, setObstacles] = useState([]);

  const measure = () => {
    const rects = [];
    const asRect = (el, pad=8) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, pad };
    };
    const modalEl = document.getElementById("order-modal-root"); // 從彈窗抓
    const b1 = asRect(bannerRef.current, 4);
    const b2 = asRect(buildingRef.current, 12);
    const b3 = asRect(tableRef.current, 8);
    const b4 = modalEl ? asRect(modalEl, 8) : null;
    [b1,b2,b3,b4].forEach(r => r && rects.push(r));
    setObstacles(rects);
  };

  useEffect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    // 由於彈窗開關/表格位置改變都會影響，放入依賴
    return () => window.removeEventListener("resize", onResize);
  }, [openSheet, chatOpen]);

  // 小技巧：下一個 animation frame 再量一次，確保 DOM 位置穩定
  useEffect(() => {
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f7ebce" }}>
      {/* 標題（障礙） */}
      <div ref={bannerRef} style={{ textAlign: "center", paddingTop: 12, color: "#c00", fontWeight: 800 }}>
        今天的G胸肉對決！
      </div>

      {/* 建築（障礙，點擊開清單） */}
      <div ref={buildingRef} style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
        <Building title="" onOpen={() => setOpenSheet(true)} />
      </div>

      {/* 表格（障礙） */}
      <div ref={tableRef} style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
        <OrdersSummaryTable />
      </div>

      {/* 聊天室浮窗 */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          style={{
            position: "fixed", right: 16, bottom: 16, width: 56, height: 56, borderRadius: "50%",
            background: "#ffcc66", border: "none", boxShadow: "0 6px 16px rgba(0,0,0,.2)", fontSize: 24, zIndex: 50
          }}
        >💬</button>
      )}
      {chatOpen && (
        <div style={{
          position: "fixed", right: 16, bottom: 16, width: 340, height: 420,
          background: "#fff", border: "1px solid #eee", borderRadius: 14, overflow: "hidden",
          boxShadow: "0 10px 22px rgba(0,0,0,.18)", zIndex: 50
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 8, borderBottom: "1px solid #eee" }}>
            <strong>聊天室</strong>
            <button onClick={() => setChatOpen(false)}>✕</button>
          </div>
          <ChatBox />
        </div>
      )}

      {/* 角色渲染（整個視窗），把障礙傳進去 */}
      <Town obstacles={obstacles} margin={24} />

      {/* 訂單面板（彈窗本身也當障礙，用 id 量測） */}
      {openSheet && <OrderSheetModal onClose={() => setOpenSheet(false)} stallId="bakery" />}
    </div>
  );
}
