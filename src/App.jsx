// src/App.jsx
import React, { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, ensureAdmin } from "./firebase.js";

import { PlayerProvider } from "./store/playerContext.jsx";
import MarketTown from "./pages/MarketTown.jsx";
import LoginGate from "./components/LoginGate.jsx";
import './styles/responsive.css';


export default function App() {
  useEffect(() => {
    // 監聽登入狀態
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      try {
        // 只檢查，不寫入
        await ensureAdmin();
        // 若你需要在「第一次初始化專案」時自動成為 admin，可以這樣：
        // await ensureAdmin({ bootstrap: true });
      } catch (e) {
        console.error("ensureAdmin 失敗：", e);
      }
    });
    return () => off();
  }, []);

  return (
    <PlayerProvider>
      <MarketTown />
      {/* 登入/註冊（匿名升級） */}
      <LoginGate />
    </PlayerProvider>
  );
}
