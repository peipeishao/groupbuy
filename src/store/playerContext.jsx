// src/store/playerContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { db, auth } from "../firebase.js";
import {
  ref,
  onValue,
  set,
  update,
  onDisconnect,
  get,
} from "firebase/database";
import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
} from "firebase/auth";

const PlayerCtx = createContext(null);
export const usePlayer = () => useContext(PlayerCtx);

export function PlayerProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [publicProfile, setPublicProfile] = useState(null);
  const [privateProfile, setPrivateProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // 讓元件可以開啟 LoginGate
  const loginGateRef = useRef(null);
  const registerLoginGate = (api) => (loginGateRef.current = api);
  const openLoginGate = (opts = {}) => loginGateRef.current?.open?.(opts);
  const closeLoginGate = () => loginGateRef.current?.close?.();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        // 沒有使用者 → 自動匿名登入
        await signInAnonymously(auth);
        return;
      }
      setUser(u);
      setIsAnonymous(!!u.isAnonymous);

      // 訂閱 admin 標記
      const adminRef = ref(db, `admins/${u.uid}`);
      const offAdmin = onValue(adminRef, (snap) => setIsAdmin(snap.val() === true));

      if (u.isAnonymous) {
        setPublicProfile(null);
        setPrivateProfile(null);
        return () => {
          offAdmin();
        };
      }

      const pubRef = ref(db, `playersPublic/${u.uid}`);
      const priRef = ref(db, `playersPrivate/${u.uid}`);
      const [pubSnap, priSnap] = await Promise.all([get(pubRef), get(priRef)]);
      const pri = priSnap.exists() ? priSnap.val() : null;

      // ✅ 規則要求 roleName 長度 > 0
      const defaultRoleName = (pri?.username && String(pri.username)) || "旅人";
      const safeRoleName =
        defaultRoleName.length > 20 ? defaultRoleName.slice(0, 20) : defaultRoleName;

      // 初次建立 playersPublic
      if (!pubSnap.exists()) {
        try {
          await set(pubRef, {
            uid: u.uid,
            roleName: safeRoleName,
            avatar: "bunny",
            x: 400,
            y: 300,
            dir: "down",
            bubble: null,
            coins: 100,
            online: true,
            updatedAt: Date.now(), // ✅ 改成 number
          });
        } catch (e) {
          console.error("建立 playersPublic 失敗：", e);
        }
      }

      // 初次建立 playersPrivate
      if (!priSnap.exists()) {
        try {
          await set(priRef, {
            uid: u.uid,
            realName: "",
            username: pri?.username || "",
            updatedAt: Date.now(),
          });
        } catch (e) {
          console.error("建立 playersPrivate 失敗：", e);
        }
      }

      const offPub = onValue(pubRef, (s) => setPublicProfile(s.val() || null));
      const offPri = onValue(priRef, (s) => setPrivateProfile(s.val() || null));
      onDisconnect(pubRef).update({ online: false }).catch(() => {});

      return () => {
        offPub();
        offPri();
        offAdmin();
      };
    });
    return () => unsub();
  }, []);

  const logoutAndGoAnonymous = async () => {
    try {
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        await update(ref(db, `playersPublic/${auth.currentUser.uid}`), {
          online: false,
          updatedAt: Date.now(),
        }).catch(() => {});
      }
      await signOut(auth);
      await signInAnonymously(auth); // 登出後回匿名
      closeLoginGate();
    } catch (e) {
      console.error(e);
    }
  };

  const value = {
    uid: user?.uid || null,
    user,
    isAnonymous,
    isAdmin,
    profile: publicProfile
      ? { ...publicProfile, realName: privateProfile?.realName || "" }
      : { roleName: "旅人", avatar: "bunny", coins: 0, realName: "" },
    roleName: publicProfile?.roleName || "旅人",
    realName: privateProfile?.realName || "",
    avatar: publicProfile?.avatar || "bunny",
    registerLoginGate,
    openLoginGate,
    closeLoginGate,
    logoutAndGoAnonymous,
  };

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}
