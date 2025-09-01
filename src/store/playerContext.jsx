// src/store/playerContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { db, auth } from "../firebase.js";
import { ref, onValue, set, update, onDisconnect, serverTimestamp } from "firebase/database";

const PlayerCtx = createContext(null);
export const usePlayer = () => useContext(PlayerCtx);

export function PlayerProvider({ children }) {
  const uid = auth.currentUser?.uid || null;

  const [publicProfile, setPublicProfile] = useState({
    uid: uid || "",
    roleName: "",
    avatar: "bunny",
    x: 400,
    y: 300,
    dir: "down",
    bubble: null,
    online: true,
    updatedAt: 0,
  });

  const [privateProfile, setPrivateProfile] = useState({
    uid: uid || "",
    realName: "",
    updatedAt: 0,
  });

  // 初次建立/訂閱自己的玩家資料（Public + Private）
  useEffect(() => {
    if (!uid) return;

    const pubRef = ref(db, `playersPublic/${uid}`);
    const priRef = ref(db, `playersPrivate/${uid}`);

    // Public
    const offPub = onValue(pubRef, (snap) => {
      if (snap.exists()) {
        setPublicProfile((p) => ({ ...p, ...snap.val() }));
      } else {
        set(pubRef, {
          ...publicProfile,
          uid,
          online: true,
          updatedAt: serverTimestamp(),
        });
      }
    });

    // Private
    const offPri = onValue(priRef, (snap) => {
      if (snap.exists()) {
        setPrivateProfile((p) => ({ ...p, ...snap.val() }));
      } else {
        set(priRef, {
          ...privateProfile,
          uid,
          updatedAt: serverTimestamp(),
        });
      }
    });

    // 斷線狀態
    onDisconnect(pubRef).update({ online: false });

    return () => {
      offPub();
      offPri();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const savePublic = (patch) =>
    uid ? update(ref(db, `playersPublic/${uid}`), patch) : Promise.resolve();

  const savePrivate = (patch) =>
    uid ? update(ref(db, `playersPrivate/${uid}`), patch) : Promise.resolve();

  const setIdentity = async ({ roleName, realName, avatar }) => {
    if (!uid) return;
    await Promise.all([
      savePublic({
        roleName: roleName ?? publicProfile.roleName,
        avatar: avatar ?? publicProfile.avatar,
        online: true,
        updatedAt: serverTimestamp(),
      }),
      savePrivate({
        realName: realName ?? privateProfile.realName,
        updatedAt: serverTimestamp(),
      }),
    ]);
    setPublicProfile((p) => ({
      ...p,
      roleName: roleName ?? p.roleName,
      avatar: avatar ?? p.avatar,
    }));
    setPrivateProfile((p) => ({
      ...p,
      realName: realName ?? p.realName,
    }));
  };

  // 節流寫入位置，避免過多 RTDB 寫入（約 ~60ms 一次）
  const updatePosition = (() => {
    let last = 0;
    return async (x, y, dir) => {
      if (!uid) return;
      const now = performance.now();
      if (now - last < 60) return;
      last = now;
      setPublicProfile((p) => ({ ...p, x, y, dir, online: true }));
      await savePublic({ x, y, dir, online: true, updatedAt: serverTimestamp() });
    };
  })();

  const setBubble = async (text) => {
    if (!uid) return;
    const bubble = text ? { text, ts: Date.now() } : null;
    setPublicProfile((p) => ({ ...p, bubble }));
    await savePublic({ bubble });
    if (text) {
      setTimeout(() => savePublic({ bubble: null }), 3000);
    }
  };

  // 對外提供的便利屬性（舊程式相容）
  const value = {
    uid,
    // 舊 code 若用 player.profile.* 也能讀到
    profile: {
      ...publicProfile,
      realName: privateProfile.realName,
      coins: publicProfile.coins ?? 0,
    },
    roleName: publicProfile.roleName,
    realName: privateProfile.realName,
    avatar: publicProfile.avatar,
    setIdentity,
    updatePosition,
    setBubble,
  };

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}
// 加在 PlayerProvider 內部

// 變更「公開顯示名」（會記錄到私有更名歷程，僅管理員可讀）
const changeRoleName = async (nextName) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const prev = (publicProfile.roleName || "") + "";
  const to = (nextName || "").trim();
  if (!to || to === prev) return;

  await Promise.all([
    update(ref(db, `playersPublic/${uid}`), {
      roleName: to,
      updatedAt: serverTimestamp(),
    }),
    push(ref(db, `playersPrivate/${uid}/nameHistory`), {
      from: prev || null,
      to,
      ts: serverTimestamp(),
      by: uid,
    }),
  ]);

  setPublicProfile((p) => ({ ...p, roleName: to }));
};

// （可選）一次改真實姓名：僅存在私有檔案
const changeRealName = async (nextRealName) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const to = (nextRealName || "").trim();
  if (!to) return;
  await update(ref(db, `playersPrivate/${uid}`), {
    realName: to,
    updatedAt: serverTimestamp(),
  });
  setPrivateProfile((p) => ({ ...p, realName: to }));
};

// 然後記得把這兩個方法加到 value 供外部使用
