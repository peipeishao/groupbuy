
// src/App.jsx
import React from "react";
import OrderForm from "./components/OrderForm";
import OrdersList from "./components/OrdersList";
import ChatBox from "./components/ChatBox";
import DanmuOverlay from "./components/DanmuOverlay";
import { db} from "./firebase"; // 這樣就能拿到 db, auth
import { ref, push } from "firebase/database"; // push 函式用於新增資料

export default function App(){
  // 截止日期 (年月日)
  const DEADLINE = new Date("2025-08-29T23:59:59");

   // 測試用的函式，移到這個 App 元件裡面
  const addTestOrder = async () => {
    // 這裡的 auth 和 db 是從上方 import 進來的
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

  // 將函式掛載到全域 window 物件，方便在開發者工具中呼叫
  window.addTestOrder = addTestOrder;

  return (
    <div className="container">
      <header style={{marginBottom:16}}>
        <h1 style={{margin:0}}>平價雞胸肉-金豐盛(100/g) VS. 奢華雞胸肉-台畜(160g/包)</h1>
        <p style={{color: (new Date() > DEADLINE ? "#ef4444":"#0f172a")}}>
          截止日期：2025/08/29 {new Date() > DEADLINE ? "（已截止）" : ""}
        </p>
      </header>

      <main style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16}}>
        {/* 左側: 商品與下單 */}
        <section>
          <OrderForm DEADLINE={DEADLINE} />
        </section>

        {/* 右側: 訂單列表 / 聊天 */}
        <aside style={{display:"flex", flexDirection:"column", gap:16}}>
          <OrdersList />
          <ChatBox />
        </aside>
      </main>

      <DanmuOverlay />
      {/* 可以在這裡新增一個測試按鈕，讓測試更方便 */}
      <button onClick={addTestOrder}>新增測試訂單</button>
    </div>
  );
}