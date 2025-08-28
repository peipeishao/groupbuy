
// src/App.jsx
import React from "react";
import Market from "./pages/Market";
import { PlayerProvider } from "./store/playerContext.jsx";

export default function App() {
  return (
    <PlayerProvider>
      <Market />
    </PlayerProvider>
  );
}


