import React, { useState } from "react";
import OrderForm from "./components/OrderForm.jsx";
import OrdersList from "./components/OrdersList.jsx";
import ChatBox from "./components/ChatBox.jsx";
import DanmuOverlay from "./components/DanmuOverlay.jsx";
import AdminPanel from "./components/AdminPanel.jsx"; // 引入新的 AdminPanel 元件
import { db } from "./firebase.js"; // 這樣就能拿到 db, auth
import { ref, push } from "firebase/database"; // push 函式用於新增資料

// 自訂 hook，用於管理彈幕
const useDanmu = () => {
  const addDanmu = async (text, type = "message") => {
    try {
      await push(ref(db, "danmus"), { text, type, createdAt: Date.now() });
    } catch (error) {
      console.error("Failed to add danmu:", error);
    }
  };
  return addDanmu;
};

export default function App() {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const DEADLINE = new Date("2025-08-29T23:59:59");
  const addDanmu = useDanmu(); // 使用自訂 hook

  // 測試用的函式
  const addTestOrder = async () => {
    const user = auth.currentUser;
    if (!user) {
      console.error("請先登入才能新增測試訂單！");
      return;
    }

    const payload = {
      product: "經典蒜辣雞Q丸",
      quantity: 2,
      createdBy: user.uid,
      createdAt: Date.now(),
    };

    await push(ref(db, "orders"), payload);
    console.log("✅ 測試訂單已新增！");
  };

  return (
    <div className="container">
      <header style={{marginBottom:16}}>
        <h1 style={{margin:0}}>團購管理平台</h1>
        <p style={{color: (new Date() > DEADLINE ? "#ef4444":"#0f172a")}}>
          截止日期：2025/08/29 {new Date() > DEADLINE ? "（已截止）" : ""}
        </p>
        <div style={{marginTop: 10}}>
          <button onClick={() => setShowAdminPanel(false)} style={{marginRight: 8}}>使用者頁面</button>
          <button onClick={() => setShowAdminPanel(true)}>團長後台</button>
        </div>
      </header>

      <main style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16}}>
        {/* 左側: 商品與下單 / 團長後台 */}
        <section>
          {showAdminPanel ? (
            <AdminPanel />
          ) : (
            <OrderForm DEADLINE={DEADLINE} addDanmu={addDanmu} />
          )}
        </section>

        {/* 右側: 訂單列表 / 聊天 */}
        <aside style={{display:"flex", flexDirection:"column", gap:16}}>
          <OrdersList />
          <ChatBox />
        </aside>
      </main>

      <DanmuOverlay />
      <button onClick={addTestOrder}>新增測試訂單</button>
    </div>
  );
}

