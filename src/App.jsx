// src/App.jsx
import React, { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, ensureAdmin } from "./firebase.js";

import { PlayerProvider } from "./store/playerContext.jsx";
import MarketTown from "./pages/MarketTown.jsx";
import LoginGate from "./components/LoginGate.jsx";

export default function App() {
  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => { if (u) ensureAdmin?.(); });
    return () => off();
  }, []);

  return (
    <PlayerProvider>
      <MarketTown />
      <LoginGate />   {/* ✅ 掛著但預設隱藏 */}
    </PlayerProvider>
  );
}
