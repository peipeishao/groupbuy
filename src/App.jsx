import React from "react";
import { PlayerProvider } from "./store/playerContext.jsx";
import MarketTown from "./pages/MarketTown.jsx";

export default function App() {
  return (
    <PlayerProvider>
      <MarketTown />
    </PlayerProvider>
  );
}

