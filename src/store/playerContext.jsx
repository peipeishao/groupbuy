// src/store/playerContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "../firebase.js";
import { ref, onValue, set, update, onDisconnect } from "firebase/database";

const PlayerCtx = createContext(null);
export const usePlayer = () => useContext(PlayerCtx);

function ensureUid() {
  let uid = localStorage.getItem("uid");
  if (!uid) {
    uid = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
    localStorage.setItem("uid", uid);
  }
  return uid;
}

export function PlayerProvider({ children }) {
  const uid = ensureUid();
  const [profile, setProfile] = useState({
    name: "",
    realName: "",
    avatar: "bunny",
    coins: 100,
    level: 1,
    badges: {},
    inventory: {},
    equippedOutfit: null,
    x: 400,
    y: 300,
    dir: "down",
    bubble: null,
    online: true,
  });

  // 初次建立/訂閱自己的玩家資料
  useEffect(() => {
    const meRef = ref(db, `players/${uid}`);
    const unsub = onValue(meRef, (snap) => {
      if (snap.exists()) setProfile((p) => ({ ...p, ...snap.val() }));
      else
        set(meRef, {
          ...profile,
          lastActive: Date.now(),
          online: true,
        });
    });
    onDisconnect(meRef).update({ online: false });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (patch) => update(ref(db, `players/${uid}`), patch);

  const setIdentity = async ({ name, realName, avatar }) => {
    await save({ name, realName, avatar, online: true, lastActive: Date.now() });
    setProfile((p) => ({ ...p, name, realName, avatar }));
  };

  // 節流寫入位置，避免過多 RTDB 寫入
  const updatePosition = (() => {
    let last = 0;
    return async (x, y, dir) => {
      const now = performance.now();
      if (now - last < 60) return;
      last = now;
      setProfile((p) => ({ ...p, x, y, dir, online: true }));
      await save({ x, y, dir, online: true, lastActive: Date.now() });
    };
  })();

  const setBubble = async (text) => {
    const bubble = { text, ts: Date.now() };
    setProfile((p) => ({ ...p, bubble }));
    await save({ bubble });
    setTimeout(() => save({ bubble: null }), 3000);
  };

  const value = { uid, profile, setIdentity, updatePosition, setBubble };
  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}
