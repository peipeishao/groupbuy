// src/pages/Town.jsx — auth ready 後再訂閱 playersPublic 版
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { usePlayer } from "../store/playerContext.jsx";
import { db, auth } from "../firebase.js";
import { onValue, ref as dbRef, update } from "firebase/database";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

const SPEED = 4;
const MIN_XY = 0;
const MAX_XY = 5000;
const SPAWN_BOX = { x1: 3600, y1: 200, x2: 3900, y2: 440 };

// ✅ 氣泡顯示時長（毫秒）
const BUBBLE_MS = 3000;

const AVATAR_EMOJI = { bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" };

const LS_RIGHT_COLLAPSE = "gb.rightSidebar.collapsed";

export default function Town() {
  const { uid, profile, isConnected } = usePlayer() || {};
  const [players, setPlayers] = useState({});
  const [maskReady, setMaskReady] = useState(false);

  // --- movement internals ---
  const ctxRef = useRef(null);
  const keysRef = useRef({});
  const lastSentRef = useRef({ x: null, y: null, dir: null });
  const uidRef = useRef(null);
  const myPosRef = useRef({ x: 400, y: 300, dir: "down" });

  // --- right roster panel ---
  const [rightCollapsed, setRightCollapsed] = useState(
    () => localStorage.getItem(LS_RIGHT_COLLAPSE) === "1"
  );

  useEffect(() => { uidRef.current = uid; }, [uid]);

  // 走道遮罩（可無）
  useEffect(() => {
    const img = new Image();
    img.src = "/walkable-mask.png";
    img.onload = () => {
      const cvs = document.createElement("canvas");
      cvs.width = img.width; cvs.height = img.height;
      const ctx = cvs.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      ctxRef.current = ctx;
      setMaskReady(true);
    };
  }, []);

  const isWalkable = (x, y) => {
    const ctx = ctxRef.current;
    if (!ctx) return true;
    const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const [r, g, b, a] = d;
    const brightness = (r + g + b) / 3;
    return brightness > 128 || a === 0;
  };

  // ✅ 等到 auth 準備好（含匿名登入）之後才訂閱 playersPublic
  useEffect(() => {
    let offPlayers = () => {};
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          // 尚未登入 → 匿名登入；等下一次 onAuthStateChanged 觸發後再訂閱
          await signInAnonymously(auth);
          return;
        }
        // 已登入 → 開始訂閱（避免重複掛）
        offPlayers();
        offPlayers = onValue(
          dbRef(db, "playersPublic"),
          (snap) => setPlayers(snap.val() || {}),
          (err) => console.warn("[playersPublic] subscribe error:", err)
        );
      } catch (e) {
        console.error("[playersPublic] auth/subscription error:", e);
      }
    });

    return () => {
      try { offPlayers(); } catch {}
      try { unsubAuth(); } catch {}
    };
  }, []);

  // 鍵盤事件
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      const t = el?.tagName?.toLowerCase();
      return t === "input" || t === "textarea" || el?.isContentEditable;
    };
    const moveKeys = ["w","a","s","d","arrowup","arrowleft","arrowdown","arrowright"];
    const kd = (e) => {
      const k = e.key.toLowerCase();
      if (!moveKeys.includes(k) || isTyping()) return;
      e.preventDefault();
      keysRef.current[k] = true;
    };
    const ku = (e) => {
      const k = e.key.toLowerCase();
      if (!moveKeys.includes(k) || isTyping()) return;
      keysRef.current[k] = false;
    };
    window.addEventListener("keydown", kd, { passive: false });
    window.addEventListener("keyup", ku);
    const blur = () => { keysRef.current = {}; };
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // uid 變更時重置鍵位與本地座標
  useEffect(() => {
    keysRef.current = {};
    lastSentRef.current = { x: null, y: null, dir: null };
    const px = Number(players?.[uid]?.x ?? profile?.x ?? 400);
    const py = Number(players?.[uid]?.y ?? profile?.y ?? 300);
    const pdir = String(players?.[uid]?.dir ?? profile?.dir ?? "down");
    myPosRef.current = { x: px, y: py, dir: pdir };
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // 伺服器同步到自己的節點時，初次/重連以伺服器為準
  useEffect(() => {
    if (!uid) return;
    const me = players[uid];
    if (!me) return;
    myPosRef.current = {
      x: Number(me.x ?? myPosRef.current.x ?? 400),
      y: Number(me.y ?? myPosRef.current.y ?? 300),
      dir: String(me.dir ?? myPosRef.current.dir ?? "down"),
    };
  }, [players, uid]);

  // 寫回自己位置
  const sendMyPosition = useCallback(async (nx, ny, dir) => {
    const u = auth.currentUser;
    if (!u) return;
    nx = Math.max(MIN_XY, Math.min(MAX_XY, nx));
    ny = Math.max(MIN_XY, Math.min(MAX_XY, ny));
    const last = lastSentRef.current;
    if (last.x === nx && last.y === ny && last.dir === dir) return;
    try {
      await update(dbRef(db, `playersPublic/${u.uid}`), { x: nx, y: ny, dir, updatedAt: Date.now() });
      lastSentRef.current = { x: nx, y: ny, dir };
    } catch (e) { console.warn("[updatePosition] failed", e); }
  }, []);

  // 主迴圈（匿名/登入都可移動）
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const meUid = uidRef.current;
      if (meUid) {
        let { x, y, dir } = myPosRef.current;

        const k = keysRef.current;
        let nx = x, ny = y, ndir = dir;

        if (k.w || k.arrowup)   { ny -= SPEED; ndir = "up"; }
        if (k.s || k.arrowdown) { ny += SPEED; ndir = "down"; }
        if (k.a || k.arrowleft) { nx -= SPEED; ndir = "left"; }
        if (k.d || k.arrowright){ nx += SPEED; ndir = "right"; }

        nx = Math.max(MIN_XY, Math.min(MAX_XY, nx));
        ny = Math.max(MIN_XY, Math.min(MAX_XY, ny));

        if (maskReady) {
          if ((nx !== x) && isWalkable(nx, y)) x = nx;
          if ((ny !== y) && isWalkable(x, ny)) y = ny;
        } else { x = nx; y = ny; }

        const changed = (x !== myPosRef.current.x) || (y !== myPosRef.current.y) || (ndir !== myPosRef.current.dir);
        if (changed) {
          myPosRef.current = { x, y, dir: ndir };
          sendMyPosition(x, y, ndir);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [maskReady, sendMyPosition]);

  useEffect(() => {
    localStorage.setItem(LS_RIGHT_COLLAPSE, rightCollapsed ? "1" : "0");
  }, [rightCollapsed]);

  // 渲染用的玩家清單：合併本地自己的座標
  const renderEntries = useMemo(() => {
    const out = Object.entries(players).map(([id, p]) => [id, { ...p }]);
    if (uid) {
      const me = players[uid] || {};
      const mine = {
        ...me,
        uid,
        roleName: (me.roleName ?? profile?.roleName ?? "旅人"),
        avatar: me.avatar ?? profile?.avatar ?? "bunny",
        // ✅ 自訂頭像網址（若 RTDB 還沒同步，用 profile 補上）
        avatarUrl: me.avatarUrl ?? profile?.avatarUrl ?? null,
        x: myPosRef.current.x ?? me.x ?? 400,
        y: myPosRef.current.y ?? me.y ?? 300,
        dir: myPosRef.current.dir ?? me.dir ?? "down",
        // 🔵 自己的燈號以 RTDB 連線狀態為準
        online: isConnected ? true : !!me.online,
      };
      const idx = out.findIndex(([id]) => id === uid);
      if (idx >= 0) out[idx][1] = mine; else out.push([uid, mine]);
    }
    return out;
  }, [players, uid, profile, isConnected]);

  const roster = useMemo(() => {
    const arr = renderEntries.map(([id, p]) => ({
      id,
      roleName: p.roleName || "旅人",
      avatar: p.avatar || "bunny",
      avatarUrl: p.avatarUrl || "", // ✅ 右側清單也拿到自訂頭像網址
      online: !!p.online,
    }));
    arr.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      const an = a.roleName.toLowerCase(), bn = b.roleName.toLowerCase();
      if (an < bn) return -1; if (an > bn) return 1;
      return a.id < b.id ? -1 : 1;
    });
    return arr;
  }, [renderEntries]);

  return (
    <>
      {/* 地圖上的玩家 */}
      <div style={{ position: "relative", zIndex: 20 }}>
        {renderEntries.map(([id, p]) => (
          <div
            key={id}
            style={{
              position: "fixed",
              left: (p.x ?? 300) - 20,
              top: (p.y ?? 300) - 20,
              textAlign: "center",
              pointerEvents: "none",
              zIndex: 20,
            }}
            title={p.online ? "上線中" : "離線"}
          >
            {(p.bubble?.text && (Date.now() - (Number(p.bubble?.ts)||0) <= BUBBLE_MS)) && (
              <div
                style={{
                  transform: "translateY(-44px)",
                  background: "#fff",
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: "4px 8px",
                  fontSize: 12,
                  maxWidth: 220,
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                {p.bubble.text}
              </div>
            )}
            <div
              style={{
                width: 40, height: 40, borderRadius: 12, background: "#fff",
                border: id === uid ? "3px solid #1d4ed8" : "1px solid #eee",
                boxShadow: id === uid ? "0 0 0 3px rgba(29,78,216,.15)" : "none",
                display: "grid", placeItems: "center",
                overflow: "hidden", // ✅ 讓自訂頭像裁邊
              }}
            >
              {/* ✅ 地圖上的頭像：有自訂圖就顯示圖片，否則顯示預設 emoji */}
              {(p.avatar === "custom" && p.avatarUrl) ? (
                <img
                  src={p.avatarUrl}
                  alt={p.roleName || ""}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }}
                />
              ) : (
                <div style={{ fontSize: 24 }}>
                  {AVATAR_EMOJI[p.avatar || "bunny"] || "🙂"}
                </div>
              )}
            </div>
            <div
              style={{
                marginTop: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "#333",
                fontWeight: 600,
              }}
            >
              <span
                aria-label={p.online ? "上線中" : "離線"}
                title={p.online ? "上線中" : "離線"}
                style={{
                  width: 8, height: 8, borderRadius: 999,
                  background: p.online ? "#10b981" : "#bdbdbd",
                  boxShadow: p.online ? "0 0 0 3px rgba(16,185,129,.18)" : "none",
                }}
              />
              <span>{p.roleName || "旅人"}{id === uid ? " (你)" : ""}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 右側玩家清單（可收合） */}
      <div
        style={{
          position: "fixed",
          top: 16,
          right: rightCollapsed ? -272 : 16,
          width: 256,
          maxHeight: "calc(100vh - 32px)",
          background: "rgba(255,255,255,.95)",
          border: "1px solid #eee",
          borderRadius: 16,
          boxShadow: "0 12px 28px rgba(0,0,0,.12)",
          padding: 12,
          zIndex: 90,
          transition: "right .18s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 800 }}>小鎮人數（{roster.length}）</div>
          <div style={{ fontSize: 12, color: "#666" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#10b981" }} />
              上線
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#bdbdbd" }} />
              離線
            </span>
          </div>
        </div>
        <div style={{ overflow: "auto", maxHeight: "calc(100vh - 32px - 40px)" }}>
          {roster.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", borderBottom: "1px dashed #f0f0f0" }}>
              <div style={{
                width: 28, height: 28, borderRadius: 10, background: "#fff", border: "1px solid #eee",
                display: "grid", placeItems: "center", overflow: "hidden" // ✅ 讓圖片裁切
              }}>
                {/* ✅ 右側列表的頭像：優先顯示自訂圖 */}
                {(p.avatar === "custom" && p.avatarUrl) ? (
                  <img src={p.avatarUrl} alt={p.roleName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
                ) : (
                  <div style={{ fontSize: 18 }}>{AVATAR_EMOJI[p.avatar] || "🙂"}</div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                <span aria-label={p.online ? "上線中" : "離線"} title={p.online ? "上線中" : "離線"} style={{ width: 8, height: 8, borderRadius: 999, background: p.online ? "#10b981" : "#bdbdbd" }} />
                <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.roleName || "旅人"}
                </div>
              </div>
            </div>
          ))}
          {roster.length === 0 && (
            <div style={{ color: "#666", fontSize: 12, padding: 8 }}>目前沒有玩家。</div>
          )}
        </div>
      </div>

      {/* 右側清單收合切換鈕 */}
      <button
        onClick={() => setRightCollapsed((v) => !v)}
        title={rightCollapsed ? "展開村民清單" : "收合村民清單"}
        style={{
          position: "fixed",
          top: 16,
          right: rightCollapsed ? 16 : 288,
          padding: "8px 10px",
          borderRadius: 12,
          border: "1px solid #ddd",
          background: "#fff",
          fontWeight: 800,
          cursor: "pointer",
          zIndex: 95,
          transition: "right .18s ease",
        }}
      >
        {rightCollapsed ? "村民清單 ◀" : "村民清單 ▶"}
      </button>
    </>
  );
}
