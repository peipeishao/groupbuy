// src/pages/Town.jsx
import React, { useEffect, useRef, useState } from "react";
import { usePlayer } from "../store/playerContext.jsx";
import { db } from "../firebase.js";
import { onValue, ref } from "firebase/database";

const SPEED = 4;
const R = 20; // 角色半徑

export default function Town() {
  const { uid, profile, updatePosition, setBubble } = usePlayer();
  const [players, setPlayers] = useState({});
  const [maskReady, setMaskReady] = useState(false);
  const ctxRef = useRef(null);
  const keysRef = useRef({});

  // 🔹 1. 載入遮罩
  useEffect(() => {
    const img = new Image();
    img.src = "/walkable-mask.png"; // 放 public/ 底下
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

  // 🔹 2. 判斷是否可走
  const isWalkable = (x, y) => {
    const ctx = ctxRef.current;
    if (!ctx) return true;
    const data = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const [r, g, b, a] = data;
    const brightness = (r + g + b) / 3;
    return brightness > 128 || a === 0; // 白或透明 = 可走
  };

  // 🔹 3. 訂閱所有玩家
  useEffect(() => {
    const off = onValue(ref(db, "players"), (snap) => {
      setPlayers(snap.val() || {});
    });
    return () => off();
  }, []);

  // 🔹 4. 鍵盤事件
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      const t = el?.tagName?.toLowerCase();
      return t === "input" || t === "textarea" || el?.isContentEditable;
    };
    const isMove = (k) =>
      ["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(k);

    const kd = (e) => {
      const k = e.key.toLowerCase();
      if (!isMove(k) || isTyping()) return;
      e.preventDefault();
      keysRef.current[k] = true;
    };
    const ku = (e) => {
      const k = e.key.toLowerCase();
      if (!isMove(k) || isTyping()) return;
      keysRef.current[k] = false;
    };
    window.addEventListener("keydown", kd, { passive: false });
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  // 🔹 5. 移動 loop
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      let { x = 300, y = 300, dir = "down" } = profile;
      const k = keysRef.current;
      let nx = x,
        ny = y;

      if (k.w || k.arrowup) {
        ny -= SPEED;
        dir = "up";
      }
      if (k.s || k.arrowdown) {
        ny += SPEED;
        dir = "down";
      }
      if (k.a || k.arrowleft) {
        nx -= SPEED;
        dir = "left";
      }
      if (k.d || k.arrowright) {
        nx += SPEED;
        dir = "right";
      }

      if (maskReady) {
        if (nx !== x && isWalkable(nx, y)) x = nx;
        if (ny !== y && isWalkable(x, ny)) y = ny;
      } else {
        x = nx;
        y = ny;
      }

      if (x !== profile.x || y !== profile.y) updatePosition(x, y, dir);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [profile, maskReady, updatePosition]);

  // 🔹 6. 畫玩家
  const AVATAR_EMOJI = { bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" };

  return (
    <div>
      {Object.entries(players).map(([id, p]) => (
        <div
          key={id}
          style={{
            position: "fixed",
            left: (p.x ?? 300) - 20,
            top: (p.y ?? 300) - 20,
            textAlign: "center",
            pointerEvents: "none", // 避免擋滑鼠
          }}
        >
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
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #eee",
              display: "grid",
              placeItems: "center",
            }}
          >
            <div style={{ fontSize: 24 }}>
              {AVATAR_EMOJI[p.avatar || "bunny"] || "🙂"}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#333", fontWeight: 600 }}>
            {p.name || "旅人"}
            {id === uid ? " (你)" : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
