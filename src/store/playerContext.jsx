// src/store/playerContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { db, auth } from "../firebase.js";
import {
  ref, onValue, set, update, onDisconnect, get, remove,
} from "firebase/database";
import {
  onAuthStateChanged, signInAnonymously, signOut,
} from "firebase/auth";

const PlayerCtx = createContext(null);
export const usePlayer = () => useContext(PlayerCtx);

export function PlayerProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [publicProfile, setPublicProfile] = useState(null);
  const [privateProfile, setPrivateProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [isConnected, setIsConnected] = useState(false); // 🔵 RTDB 連線狀態

  // LoginGate 控制
  const loginGateRef = useRef(null);
  const registerLoginGate = (api) => (loginGateRef.current = api);
  const openLoginGate = (opts = {}) => loginGateRef.current?.open?.(opts);
  const closeLoginGate = () => loginGateRef.current?.close?.();

  // presence handlers
  const disconnectRef = useRef(null);
  const connectedOffRef = useRef(null);

  async function installPresence(u) {
    const me = u ?? auth.currentUser;
    if (!me) return;

    const pubRef = ref(db, `playersPublic/${me.uid}`);
    const priRef = ref(db, `playersPrivate/${me.uid}`);

    const [pubSnap, priSnap] = await Promise.all([get(pubRef), get(priRef)]);
    const pri = priSnap.exists() ? priSnap.val() : null;

    const defaultRoleName = (pri?.username && String(pri.username)) || "旅人";
    const safeRoleName = defaultRoleName.length > 20 ? defaultRoleName.slice(0, 20) : defaultRoleName;

    // 建立/更新 public：先把 online 標成 true
    if (!pubSnap.exists()) {
      await set(pubRef, {
        uid: me.uid,
        roleName: safeRoleName,
        avatar: "bunny",
        x: 400, y: 300, dir: "down",
        bubble: null,
        coins: 100,
        online: true,
        updatedAt: Date.now(),
      }).catch(() => {});
    } else {
      await update(pubRef, { online: true, updatedAt: Date.now() }).catch(() => {});
    }

    // 建立 private（非匿名）
    if (!me.isAnonymous && !priSnap.exists()) {
      await set(priRef, {
        uid: me.uid,
        realName: "",
        username: pri?.username || "",
        updatedAt: Date.now(),
      }).catch(() => {});
    }

    // onDisconnect: 斷線時標記 offline
    try {
      if (disconnectRef.current) {
        await disconnectRef.current.cancel();
        disconnectRef.current = null;
      }
      const od = onDisconnect(pubRef);
      await od.update({ online: false, updatedAt: Date.now() });
      disconnectRef.current = od;
    } catch {}

    // /.info/connected：一連上就 online=true，並更新 isConnected 供 UI 使用
    try {
      if (connectedOffRef.current) {
        connectedOffRef.current();
        connectedOffRef.current = null;
      }
      const connectedRef = ref(db, ".info/connected");
      connectedOffRef.current = onValue(connectedRef, async (snap) => {
        const ok = snap.val() === true;
        setIsConnected(ok);
        if (!ok) return;
        try {
          await update(pubRef, { online: true, updatedAt: Date.now() });
        } catch {}
        try {
          if (disconnectRef.current) {
            await disconnectRef.current.cancel();
            disconnectRef.current = null;
          }
          const od2 = onDisconnect(pubRef);
          await od2.update({ online: false, updatedAt: Date.now() });
          disconnectRef.current = od2;
        } catch {}
      });
    } catch {}
  }

  async function markOfflineOnly() {
    const me = auth.currentUser;
    if (!me) return;
    try {
      if (disconnectRef.current) {
        await disconnectRef.current.cancel();
        disconnectRef.current = null;
      }
      await update(ref(db, `playersPublic/${me.uid}`), { online: false, updatedAt: Date.now() });
    } catch {}
  }

  async function removeProfileNode() {
    const me = auth.currentUser;
    if (!me) return;
    try {
      if (disconnectRef.current) {
        await disconnectRef.current.cancel();
        disconnectRef.current = null;
      }
      await remove(ref(db, `playersPublic/${me.uid}`));
    } catch {}
  }

  async function safeSignOut({ removeNode = false } = {}) {
    try {
      if (auth.currentUser) {
        if (removeNode) await removeProfileNode();
        else await markOfflineOnly();
      }
    } finally {
      try { connectedOffRef.current?.(); } catch {}
      connectedOffRef.current = null;
      disconnectRef.current = null;
      setIsConnected(false);

      await signOut(auth);
      setUser(null);
      setIsAnonymous(true);
      setPublicProfile(null);
      setPrivateProfile(null);
    }
  }
  const logoutAndGoAnonymous = async () => safeSignOut({ removeNode: false });

  // Auth 狀態
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try { await signInAnonymously(auth); } catch {}
        return;
      }

      setUser(u);
      setIsAnonymous(!!u.isAnonymous);

      // admin 標記
      const adminRef = ref(db, `admins/${u.uid}`);
      const offAdmin = onValue(adminRef, (snap) => setIsAdmin(snap.val() === true));

      // 安裝 presence（匿名或正式帳號都裝）
      await installPresence(u);

      // 訂閱 public
      const pubRef = ref(db, `playersPublic/${u.uid}`);
      const offPub = onValue(pubRef, (s) => setPublicProfile(s.val() || null));

      // 非匿名才訂閱 private
      let offPri = () => {};
      if (!u.isAnonymous) {
        const priRef = ref(db, `playersPrivate/${u.uid}`);
        offPri = onValue(priRef, (s) => setPrivateProfile(s.val() || null));
      } else {
        setPrivateProfile(null);
      }

      return () => { offPub(); offPri(); offAdmin(); };
    });
    return () => unsub();
  }, []);

  const value = {
    uid: user?.uid || null,
    user,
    isAnonymous,
    isAdmin,
    isConnected, // 🔵 提供給 UI 使用（自己是否在線上）
    profile: publicProfile
      ? { ...publicProfile, realName: privateProfile?.realName || "" }
      : { roleName: "旅人", avatar: "bunny", coins: 0, realName: "" },
    roleName: publicProfile?.roleName || "旅人",
    realName: privateProfile?.realName || "",
    avatar: publicProfile?.avatar || "bunny",
    registerLoginGate,
    openLoginGate,
    closeLoginGate,
    safeSignOut,
    logoutAndGoAnonymous,
  };

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}
