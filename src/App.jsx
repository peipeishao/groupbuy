// src/App.jsx
import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase.js";
import { PlayerProvider } from "./store/playerContext.jsx";
import MarketTown from "./pages/MarketTown.jsx";
import LoginModal from "./components/LoginModal.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      console.log("[Auth] onAuthStateChanged →", u ? u.uid : null);
      setUser(u || null);
      setLoading(false);
    });
    return () => off();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        初始化中…
      </div>
    );
  }

  // 未登入 → 顯示登入彈窗；登入後 → 顯示村莊
  return (
    <>
      {!user && <LoginModal open={true} onDone={() => {/* 狀態改變由 onAuthStateChanged 接手 */}} />}
      {user && (
        <PlayerProvider>
          <MarketTown />
        </PlayerProvider>
      )}
    </>
  );
}
