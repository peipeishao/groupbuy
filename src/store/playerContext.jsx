// src/store/playerContext.js  (TEMP: 本地純前端版)
import React, { createContext, useContext, useState } from "react";

const PlayerCtx = createContext(null);
export const usePlayer = () => useContext(PlayerCtx);

export function PlayerProvider({ children }) {
  const [profile, setProfile] = useState({
    name: "旅人",
    coins: 100,
    level: 1,
    badges: {},
    inventory: {},
    equippedOutfit: null,
  });

  const addCoins = (n) =>
    setProfile((p) => ({ ...p, coins: (p.coins || 0) + n }));
  const deductCoins = (n) =>
    setProfile((p) => ({ ...p, coins: Math.max(0, (p.coins || 0) - n) }));
  const awardBadge = (k) =>
    setProfile((p) => ({ ...p, badges: { ...(p.badges || {}), [k]: true } }));
  const addOutfit = (id) =>
    setProfile((p) => ({ ...p, inventory: { ...(p.inventory || {}), [id]: 1 } }));
  const equipOutfit = (id) => setProfile((p) => ({ ...p, equippedOutfit: id }));

  const value = {
    uid: "dev-local",
    profile,
    addCoins,
    deductCoins,
    awardBadge,
    addOutfit,
    equipOutfit,
    setProfile,
  };
  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

