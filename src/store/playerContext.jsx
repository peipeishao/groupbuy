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
  remove,
} from "firebase/database";
import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
} from "firebase/auth";

const PlayerCtx = createContext(null);
export const usePlayer = () => useContext(PlayerCtx);

// 規則邊界（與 RTDB 規則一致）
const X_MIN = 0, X_MAX = 5000;
const Y_MIN = 0, Y_MAX = 5000;
const DIRS = new Set(["up", "down", "left", "right"]);

/** 夾在區間內 */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || 0));

export function PlayerProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [isAnonymous, setIsAnonymous] = useState(true);
  const [publicProfile, setPublicProfile] = useState(null);
  const [privateProfile, setPrivateProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [isConnected, setIsConnected] = useState(false); // RTDB 連線狀態

  // LoginGate 控制（給 LoginGate.jsx 來註冊/open/close）
  const loginGateRef = useRef(null);
  const registerLoginGate = (api) => (loginGateRef.current = api);
  const openLoginGate = (opts = {}) => loginGateRef.current?.open?.(opts);
  const closeLoginGate = () => loginGateRef.current?.close?.();

  // presence 清理用
  const disconnectRef = useRef(null);
  const connectedOffRef = useRef(null);
  const publicOffRef = useRef(null);
  const privateOffRef = useRef(null);
  const adminOffRef = useRef(null);

  // ---- Presence / Profiles 安裝 ----
  async function installPresence(u) {
    const me = u ?? auth.currentUser;
    if (!me) return;

    const pubRef = ref(db, `playersPublic/${me.uid}`);
    const priRef = ref(db, `playersPrivate/${me.uid}`);

    // 先把 private 拿來決定顯示名（若沒有就用「旅人」）
    let pri = null;
    try {
      const priSnap = await get(priRef);
      pri = priSnap.exists() ? priSnap.val() : null;
    } catch (_) {}

    const defaultRoleName = (pri?.username && String(pri.username)) || "旅人";
    const safeRoleName =
      defaultRoleName.length > 20 ? defaultRoleName.slice(0, 20) : defaultRoleName;

    // 建立/更新 public：標記 online=true（其餘欄位符合 validate）
    try {
      const pubSnap = await get(pubRef);
      if (!pubSnap.exists()) {
        await set(pubRef, {
          uid: me.uid,
          roleName: safeRoleName,
          avatar: "bunny",
          x: 400,
          y: 300,
          dir: "down",
          bubble: null,
          coins: 100,
          online: true,
          updatedAt: Date.now(),
        });
      } else {
        await update(pubRef, { online: true, updatedAt: Date.now() });
      }
    } catch (e) {
      console.error("[presence] install/online failed:", e);
    }

    // 非匿名時建立 private 節點（若不存在）
    if (!me.isAnonymous) {
      try {
        const priSnap = await get(priRef);
        if (!priSnap.exists()) {
          await set(priRef, {
            uid: me.uid,
            realName: "",
            username: pri?.username || "",
            updatedAt: Date.now(),
          });
        }
      } catch (e) {
        // 若規則不允許也沒關係
      }
    }

    // onDisconnect：自動離線
    try {
      if (disconnectRef.current) {
        await disconnectRef.current.cancel();
        disconnectRef.current = null;
      }
      const od = onDisconnect(pubRef);
      await od.update({ online: false, updatedAt: Date.now() });
      disconnectRef.current = od;
    } catch (e) {
      console.warn("[presence] onDisconnect failed (will retry on reconnect)", e);
    }

    // /.info/connected：重連時補 online=true 並重設 onDisconnect
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
      await update(ref(db, `playersPublic/${me.uid}`), {
        online: false,
        updatedAt: Date.now(),
      });
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
      // 關閉所有訂閱
      try { connectedOffRef.current?.(); } catch {}
      try { publicOffRef.current?.(); } catch {}
      try { privateOffRef.current?.(); } catch {}
      try { adminOffRef.current?.(); } catch {}
      connectedOffRef.current = null;
      publicOffRef.current = null;
      privateOffRef.current = null;
      adminOffRef.current = null;
      disconnectRef.current = null;
      setIsConnected(false);

      await signOut(auth).catch(() => {});
      setUser(null);
      setIsAnonymous(true);
      setPublicProfile(null);
      setPrivateProfile(null);
      setAuthReady(false);
    }
  }

  const logoutAndGoAnonymous = async () => safeSignOut({ removeNode: false });

  // ---- Auth 生命週期 ----
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        // 首訪或剛登出 → 立即嘗試匿名登入
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("[auth] anonymous sign-in failed:", e);
        }
        return; // 等下次 onAuthStateChanged
      }

      setUser(u);
      setIsAnonymous(!!u.isAnonymous);

      // admin 標記（非 admin 會被規則擋住，這裡吞掉錯誤即可）
      try {
        const adminRef = ref(db, `admins/${u.uid}`);
        adminOffRef.current = onValue(
          adminRef,
          (snap) => setIsAdmin(snap.val() === true),
          () => setIsAdmin(false) // permission_denied → 當作不是 admin
        );
      } catch {
        setIsAdmin(false);
      }

      // 安裝 presence
      await installPresence(u);

      // 訂閱我的 public
      try {
        const pubRef = ref(db, `playersPublic/${u.uid}`);
        publicOffRef.current = onValue(pubRef, (s) => {
          setPublicProfile(s.val() || null);
        });
      } catch (_) {
        setPublicProfile(null);
      }

      // 訂閱我的 private（非匿名）
      if (!u.isAnonymous) {
        try {
          const priRef = ref(db, `playersPrivate/${u.uid}`);
          privateOffRef.current = onValue(priRef, (s) => {
            setPrivateProfile(s.val() || null);
          });
        } catch {
          setPrivateProfile(null);
        }
      } else {
        setPrivateProfile(null);
      }

      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  // ---- 對外 API ----

  /** 更新我的暱稱/頭像（登入後） */
  const updateRole = async ({ roleName, avatar }) => {
    const u = auth.currentUser;
    if (!u) return openLoginGate?.();

    const patch = { updatedAt: Date.now() };
    if (roleName != null) {
      const rn = String(roleName).slice(0, 20);
      patch.roleName = rn.length ? rn : "旅人";
    }
    if (avatar != null && ["bunny", "bear", "cat", "duck"].includes(String(avatar))) {
      patch.avatar = String(avatar);
    }
    await update(ref(db, `playersPublic/${u.uid}`), patch);
  };

  /** 更新我的座標與方向（WASD 用） */
  const updatePosition = async ({ x, y, dir }) => {
    const u = auth.currentUser;
    if (!u) return;
    const patch = { updatedAt: Date.now() };
    if (x != null) patch.x = clamp(x, X_MIN, X_MAX);
    if (y != null) patch.y = clamp(y, Y_MIN, Y_MAX);
    if (dir != null && DIRS.has(String(dir))) patch.dir = String(dir);
    try {
      await update(ref(db, `playersPublic/${u.uid}`), patch);
    } catch (e) {
      console.warn("[updatePosition] failed:", e?.message || e);
    }
  };

  /** 在頭上顯示氣泡；預設 3 秒後自動清空（所有人可見） */
  const setBubble = async (text, { durationMs = 3000 } = {}) => {
    const u = auth.currentUser;
    if (!u) return;
    const t = String(text || "").slice(0, 120);
    const now = Date.now();
    try {
      await set(ref(db, `playersPublic/${u.uid}/bubble`), t ? { text: t, ts: now } : null);
      if (t && durationMs > 0) {
        setTimeout(() => {
          set(ref(db, `playersPublic/${u.uid}/bubble`), null).catch(() => {});
        }, durationMs);
      }
    } catch (e) {
      console.warn("[setBubble] failed:", e?.message || e);
    }
  };

  const value = {
    // 狀態
    uid: user?.uid || null,
    user,
    authReady,            // ✅ 元件可用來判斷「已完成登入（含匿名）」再做事
    isAnonymous,
    isAdmin,
    isConnected,

    // 我的檔案
    profile: publicProfile
      ? { ...publicProfile, realName: privateProfile?.realName || "" }
      : { roleName: "旅人", avatar: "bunny", coins: 0, realName: "" },
    roleName: publicProfile?.roleName || "旅人",
    realName: privateProfile?.realName || "",
    avatar: publicProfile?.avatar || "bunny",

    // LoginGate 操作
    registerLoginGate,
    openLoginGate,
    closeLoginGate,

    // 行為 API
    updateRole,
    updatePosition,
    setBubble,

    // 登出/切換
    safeSignOut,
    logoutAndGoAnonymous,
  };

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}
