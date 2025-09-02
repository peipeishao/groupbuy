// src/App.jsx
import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, ensureAdmin } from "./firebase.js";

import { PlayerProvider } from "./store/playerContext.jsx";
import MarketTown from "./pages/MarketTown.jsx";
// ⬇️ 改成載入新的 LoginGate（不要再 import 舊的 LoginModal）
import LoginGate from "./components/LoginGate.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      console.log("[Auth] onAuthStateChanged ->", u ? u.uid : null);
      setUser(u || null);
      setLoading(false);
      if (u) ensureAdmin();
    });
    return () => off();
  }, []);

  if (loading) {
    return <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>初始化中…</div>;
  }

  if (!user) {
    console.log("[UI] Rendering LoginGate (NEW)");
    return <LoginGate open={true} onDone={() => {}} />;
  }

  console.log("[UI] Rendering MarketTown for", user.uid);
  return (
    <PlayerProvider>
      <MarketTown />
    </PlayerProvider>
  );
}
