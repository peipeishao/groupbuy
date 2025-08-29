// src/App.jsx
import React, { useState } from "react";
import { PlayerProvider, usePlayer } from "./store/playerContext.jsx";
import CharacterSetup from "./pages/CharacterSetup.jsx";
import Town from "./pages/Town.jsx";

function Root() {
  const { profile } = usePlayer();
  const [ready, setReady] = useState(false);
  const needSetup = !profile.name || !profile.realName;

  if (needSetup || !ready) {
    return <CharacterSetup onDone={() => setReady(true)} />;
  }
  return <Town />;
}

export default function App() {
  return (
    <PlayerProvider>
      <Root />
    </PlayerProvider>
  );
}

