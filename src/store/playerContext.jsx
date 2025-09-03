// src/store/playerContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { db, auth } from "../firebase.js";
import { ref, onValue, set, update, onDisconnect, serverTimestamp, get, push } from "firebase/database";
import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";

const PlayerCtx = createContext(null);
export const usePlayer = () => useContext(PlayerCtx);

export function PlayerProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [publicProfile, setPublicProfile] = useState(null);
  const [privateProfile, setPrivateProfile] = useState(null);

  // 讓元件可以開啟 LoginGate
  const loginGateRef = useRef(null);
  const registerLoginGate = (api) => (loginGateRef.current = api);
  const openLoginGate = (opts = {}) => loginGateRef.current?.open?.(opts);
  const closeLoginGate = () => loginGateRef.current?.close?.();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {                 // ✅ 沒有使用者 → 自動匿名登入
        await signInAnonymously(auth);
        return;
      }
      setUser(u);
      setIsAnonymous(!!u.isAnonymous);

      if (u.isAnonymous) {      // 匿名：不訂閱玩家資料、不出現在小鎮
        setPublicProfile(null);
        setPrivateProfile(null);
        return;
      }

      const pubRef = ref(db, `playersPublic/${u.uid}`);
      const priRef = ref(db, `playersPrivate/${u.uid}`);
      const [pubSnap, priSnap] = await Promise.all([get(pubRef), get(priRef)]);

      if (!pubSnap.exists()) {
        await set(pubRef, {
          uid: u.uid, roleName: "", avatar: "bunny",
          x: 400, y: 300, dir: "down", bubble: null, coins: 100,
          online: true, updatedAt: serverTimestamp(),
        });
      }
      if (!priSnap.exists()) {
        await set(priRef, { uid: u.uid, realName: "", username: "", updatedAt: serverTimestamp() });
      }

      const offPub = onValue(pubRef, (s) => setPublicProfile(s.val() || null));
      const offPri = onValue(priRef, (s) => setPrivateProfile(s.val() || null));
      onDisconnect(pubRef).update({ online: false });

      return () => { offPub(); offPri(); };
    });
    return () => unsub();
  }, []);

  const logoutAndGoAnonymous = async () => {
    try {
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        await update(ref(db, `playersPublic/${auth.currentUser.uid}`), { online: false, updatedAt: serverTimestamp() }).catch(()=>{});
      }
      await signOut(auth);
      await signInAnonymously(auth);   // ✅ 登出後回匿名
      closeLoginGate();
    } catch (e) { console.error(e); }
  };

  const value = {
    uid: user?.uid || null,
    user,
    isAnonymous,
    profile: publicProfile ? { ...publicProfile, realName: privateProfile?.realName || "" } : { roleName: "旅人", avatar: "bunny", coins: 0, realName: "" },
    roleName: publicProfile?.roleName || "旅人",
    realName: privateProfile?.realName || "",
    avatar: publicProfile?.avatar || "bunny",
    registerLoginGate,
    openLoginGate,
    logoutAndGoAnonymous,
  };

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}
