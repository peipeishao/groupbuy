// src/pages/Town.jsx
import React, { useEffect, useRef, useState } from "react";
import { usePlayer } from "../store/playerContext.jsx";
import { db } from "../firebase.js";
import { onValue, push, ref, serverTimestamp } from "firebase/database";

const SIZE = { w: 900, h: 560 };
const SPEED = 4;
const AVATAR_EMOJI = { bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" };

export default function Town() {
  const { uid, profile, updatePosition, setBubble } = usePlayer();
  const [players, setPlayers] = useState({});
  const keysRef = useRef({});

  // 訂閱所有玩家位置/狀態
  useEffect(() => {
    const unsub = onValue(ref(db, "players"), (snap) => {
      setPlayers(snap.val() || {});
    });
    return () => unsub();
  }, []);

  // 鍵盤控制
  useEffect(() => {
    const onKey = (e, down) => {
      const k = e.key.toLowerCase();
      if (["w","a","s","d","arrowup","arrowleft","arrowdown","arrowright"].includes(k)) {
        e.preventDefault();
        keysRef.current[k] = down;
      }
    };
    const kd = (e)=>onKey(e,true);
    const ku = (e)=>onKey(e,false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  // 移動 loop
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      let { x, y, dir } = profile;
      const k = keysRef.current;
      let moved = false;

      if (k.w || k.arrowup)   { y = Math.max(40, y - SPEED); dir = "up"; moved = true; }
      if (k.s || k.arrowdown) { y = Math.min(SIZE.h - 40, y + SPEED); dir = "down"; moved = true; }
      if (k.a || k.arrowleft) { x = Math.max(40, x - SPEED); dir = "left"; moved = true; }
      if (k.d || k.arrowright){ x = Math.min(SIZE.w - 40, x + SPEED); dir = "right"; moved = true; }

      if (moved) updatePosition(x, y, dir);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [profile, updatePosition]);

  // 簡易聊天輸入（同步聊天室＋頭頂氣泡）
  const [msg, setMsg] = useState("");
  const send = async () => {
    const text = msg.trim();
    if (!text) return;
    await push(ref(db, "chat/global"), {
      uid,
      name: profile.name || "旅人",
      text,
      ts: serverTimestamp(),
    });
    await setBubble(text); // 3 秒自動消失
    setMsg("");
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>🧭 用 WASD 移動，Enter 送出訊息</div>
      <div style={{
        position: "relative", width: SIZE.w, height: SIZE.h, background: "#FFF7E6",
        border: "1px solid #f2e6d0", borderRadius: 16, overflow: "hidden"
      }}>
        {Object.entries(players).map(([id, p]) => (
          <div key={id} style={{
            position: "absolute",
            left: (p.x || 400) - 24,
            top: (p.y || 300) - 24,
            textAlign: "center"
          }}>
            {p.bubble?.text && (
              <div style={{
                transform: "translateY(-44px)", background: "#fff", border: "1px solid #eee",
                borderRadius: 12, padding: "4px 8px", fontSize: 12, maxWidth: 220,
                whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>{p.bubble.text}</div>
            )}
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: "#fff",
              display: "grid", placeItems: "center", border: "1px solid #eee"
            }}>
              <div style={{ fontSize: 28 }}>{AVATAR_EMOJI[p.avatar || "bunny"] || "🙂"}</div>
            </div>
            <div style={{ fontSize: 12, color: "#333", marginTop: 4, fontWeight: 600 }}>
              {p.name || "旅人"}{id===uid ? " (你)" : ""}
            </div>
            <div style={{ fontSize: 10, color: p.online ? "#3c9" : "#aaa" }}>
              {p.online ? "online" : "offline"}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, width: SIZE.w }}>
        <input
          value={msg}
          onChange={(e)=>setMsg(e.target.value)}
          onKeyDown={(e)=>{ if(e.key==="Enter") send(); }}
          placeholder="在這裡聊天（會同步顯示在頭頂氣泡）"
          style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <button onClick={send} style={{ padding: "10px 16px", borderRadius: 10 }}>送出</button>
      </div>
    </div>
  );
}
