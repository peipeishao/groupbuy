// src/pages/Town.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { usePlayer } from "../store/playerContext.jsx";
import { db, auth } from "../firebase.js";
import { onValue, ref as dbRef, update } from "firebase/database";

const SPEED = 4;
const MIN_XY = 0;
const MAX_XY = 5000; // 依你的 RTDB 規則
// 右上角生成範圍（依你的地圖座標自行微調）
const SPAWN_BOX = { x1: 3600, y1: 200, x2: 3900, y2: 440 };

function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function randPointInBox({ x1, y1, x2, y2 }) {
  const lx = Math.min(x1, x2), hx = Math.max(x1, x2);
  const ly = Math.min(y1, y2), hy = Math.max(y1, y2);
  return { x: randInt(lx, hx), y: randInt(ly, hy) };
}


const AVATAR_EMOJI = { bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" };

export default function Town() {
  const { uid, profile, isAnonymous } = usePlayer() || {};
  const [players, setPlayers] = useState({});
  const [maskReady, setMaskReady] = useState(false);

  const ctxRef = useRef(null);
  const keysRef = useRef({});
  const rafRef = useRef(0);
  const lastSentRef = useRef({ x: null, y: null, dir: null });

  /* 1) 載入可走遮罩（可略過遮罩時也能移動顯示） */
  useEffect(() => {
    const img = new Image();
    img.src = "/walkable-mask.png";
    img.onload = () => {
      const cvs = document.createElement("canvas");
      cvs.width = img.width;
      cvs.height = img.height;
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

  /* 2) 訂閱 playersPublic（讀不到也沒關係，下面有 fallback 自己畫自己） */
  useEffect(() => {
    const off = onValue(dbRef(db, "playersPublic"), (snap) => {
      const v = snap.val() || {};
      setPlayers(v);
      // 除錯資訊
      try {
        const me = auth.currentUser?.uid;
        console.log("[playersPublic] count=", Object.keys(v).length, "haveMe=", !!(me && v[me]));
      } catch {}
    }, (err) => {
      console.warn("[playersPublic] subscribe error:", err);
    });
    return () => off();
  }, []);

  /* 3) 鍵盤事件（打字時不攔截） */
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      const t = el?.tagName?.toLowerCase();
      return t === "input" || t === "textarea" || el?.isContentEditable;
    };
    const isMoveKey = (k) =>
      ["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(k);

    const kd = (e) => {
      const k = e.key.toLowerCase();
      if (!isMoveKey(k) || isTyping()) return;
      e.preventDefault();
      keysRef.current[k] = true;
    };
    const ku = (e) => {
      const k = e.key.toLowerCase();
      if (!isMoveKey(k) || isTyping()) return;
      keysRef.current[k] = false;
    };
    window.addEventListener("keydown", kd, { passive: false });
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  /* 4) 寫回自己的位置（節流） */
  const sendMyPosition = useCallback(async (nx, ny, dir) => {
    const u = auth.currentUser;
    if (!u || u.isAnonymous) return;
    nx = Math.max(MIN_XY, Math.min(MAX_XY, nx));
    ny = Math.max(MIN_XY, Math.min(MAX_XY, ny));

    const last = lastSentRef.current;
    if (last.x === nx && last.y === ny && last.dir === dir) return;

    try {
      await update(dbRef(db, `playersPublic/${u.uid}`), {
        x: nx, y: ny, dir, updatedAt: Date.now(),
      });
      lastSentRef.current = { x: nx, y: ny, dir };
    } catch (e) {
      console.warn("[updatePosition] failed", e);
    }
  }, []);

  /* 5) 主 loop（使用 profile 來驅動，即使 players 訂閱不到也能動） */
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      let x = Number(profile?.x ?? 400);
      let y = Number(profile?.y ?? 300);
      let dir = String(profile?.dir ?? "down");

      const k = keysRef.current;
      let nx = x, ny = y;

      if (k.w || k.arrowup) { ny -= SPEED; dir = "up"; }
      if (k.s || k.arrowdown) { ny += SPEED; dir = "down"; }
      if (k.a || k.arrowleft) { nx -= SPEED; dir = "left"; }
      if (k.d || k.arrowright) { nx += SPEED; dir = "right"; }

      nx = Math.max(MIN_XY, Math.min(MAX_XY, nx));
      ny = Math.max(MIN_XY, Math.min(MAX_XY, ny));

      if (maskReady) {
        if (nx !== x && isWalkable(nx, y)) x = nx;
        if (ny !== y && isWalkable(x, ny)) y = ny;
      } else {
        x = nx; y = ny;
      }

      const changed = (x !== profile?.x) || (y !== profile?.y) || (dir !== profile?.dir);
      if (!isAnonymous && uid && changed) {
        sendMyPosition(x, y, dir);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [profile, maskReady, isAnonymous, uid, sendMyPosition]);

  /* 6) 組合要渲染的人：優先用 players；若 players 沒有自己，fallback 用 profile 畫出自己 */
  const renderEntries = useMemo(() => {
    const entries = Object.entries(players);
    const hasMe = uid && players && players[uid];
    if (!hasMe && uid && profile) {
      // 用 profile 補上一筆「自己」
      entries.push([uid, {
        uid,
        roleName: profile.roleName || "旅人",
        avatar: profile.avatar || "bunny",
        x: profile.x ?? 400,
        y: profile.y ?? 300,
        dir: profile.dir ?? "down",
        bubble: profile.bubble || null,
      }]);
    }
    return entries;
  }, [players, uid, profile]);

  /* 7) 傳送到中央（看不到自己時用） */
  const teleportToTopRight = useCallback(() => {
  sendMyPosition(3900, 240, "left"); // 右上角固定座標，自己調整
}, [sendMyPosition]);


  const iDontSeeMyself = useMemo(() => {
    return !!uid && !isAnonymous && !players?.[uid];
  }, [players, uid, isAnonymous]);

  return (
  <>
    {/* 看不到自己時，出現傳送按鈕 */}
    {iDontSeeMyself && (
      <div style={{
        position: "fixed", left: 16, top: 16, zIndex: 220,
        background: "rgba(254,252,232,.98)", border: "1px solid #f59e0b",
        color: "#78350f", padding: "10px 12px", borderRadius: 12,
        boxShadow: "0 8px 18px rgba(0,0,0,.12)"
      }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>找不到你的角色？</div>
        <div style={{ fontSize: 13, marginBottom: 8 }}>+         按下方按鈕把自己傳送到右上角。
        </div>
        <button
         onClick={teleportToTopRight}
          style={{
            padding: "8px 12px", borderRadius: 10, border: "2px solid #1d4ed8",
            background: "#fff", color: "#1d4ed8", fontWeight: 800, cursor: "pointer"
          }}
        >
-         傳送到中央
+         傳送到右上角
        </button>
      </div>
    )}

      {/* 玩家們（包含 fallback 的自己） */}
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
          >
            {/* 氣泡 */}
            {p.bubble?.text && (
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

            {/* 角色方塊（自己的加描邊） */}
            <div
              style={{
                width: 40, height: 40, borderRadius: 12, background: "#fff",
                border: id === uid ? "3px solid #1d4ed8" : "1px solid #eee",
                boxShadow: id === uid ? "0 0 0 3px rgba(29,78,216,.15)" : "none",
                display: "grid", placeItems: "center",
              }}
            >
              <div style={{ fontSize: 24 }}>
                {AVATAR_EMOJI[p.avatar || "bunny"] || "🙂"}
              </div>
            </div>

            {/* 名稱（公開） */}
            <div style={{ fontSize: 12, color: "#333", fontWeight: 600 }}>
              {p.roleName || "旅人"}{id === uid ? " (你)" : ""}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
