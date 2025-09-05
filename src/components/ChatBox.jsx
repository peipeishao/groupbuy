// src/components/ChatBox.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db, auth } from "../firebase.js";
import { ref, onValue, push, set, update } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";

export default function ChatBox() {
  const { uid, roleName = "旅人", openLoginGate } = usePlayer() || {};
  const [text, setText] = useState("");
  const [list, setList] = useState([]);
  const boxRef = useRef(null);

  // 訂閱全域聊天（取最後 50 則）
  useEffect(() => {
    const off = onValue(ref(db, "chat/global"), (snap) => {
      const v = snap.val() || {};
      const arr = Object.values(v);
      arr.sort((a, b) => (a.ts || 0) - (b.ts || 0));
      setList(arr.slice(-50));
    });
    return () => off();
  }, []);

  // 捲到最底
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [list]);

  const send = async () => {
    const line = text.trim();
    if (!line) return;

    const me = auth.currentUser;
    if (!me) {
      openLoginGate?.({ mode: "upgrade" });
      return;
    }

    const now = Date.now();
    try {
      // 寫入聊天室
      await push(ref(db, "chat/global"), {
        uid: me.uid,
        roleName,
        text: line,
        ts: now,
      });

      // 顯示頭頂氣泡（3 秒）
      await update(ref(db, `playersPublic/${me.uid}`), {
        bubble: { text: line.slice(0, 120), ts: now },
        updatedAt: now,
      });
      setTimeout(() => {
        // 清空 bubble（可省略，因為前端也會用 ts 自動隱藏）
        set(ref(db, `playersPublic/${me.uid}/bubble`), null);
      }, 3500);

      setText("");
    } catch (e) {
      console.error("[chat] send failed", e);
      alert("訊息送出失敗，請稍後再試");
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        width: 360,
        zIndex: 120,
        background: "rgba(255,255,255,.98)",
        border: "1px solid #eee",
        borderRadius: 14,
        boxShadow: "0 12px 28px rgba(0,0,0,.18)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          borderBottom: "1px solid #eee",
          background: "#f9fafb",
          fontWeight: 800,
        }}
      >
        小鎮聊天室
      </div>

      <div
        ref={boxRef}
        style={{
          height: 220,
          overflowY: "auto",
          padding: 10,
          display: "grid",
          gap: 6,
        }}
      >
        {list.map((m, i) => (
          <div key={i} style={{ fontSize: 13, lineHeight: 1.4 }}>
            <b>{m.roleName || "旅人"}</b>
            <span style={{ color: "#94a3b8", marginLeft: 6, fontSize: 12 }}>
              {new Date(m.ts || 0).toLocaleTimeString()}
            </span>
            <div>{m.text}</div>
          </div>
        ))}
        {list.length === 0 && (
          <div style={{ color: "#94a3b8" }}>還沒有訊息，來打招呼吧！</div>
        )}
      </div>

      <div style={{ borderTop: "1px solid #eee", padding: 8 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="輸入訊息，按 Enter 送出（Shift+Enter 換行）"
          rows={2}
          style={{
            width: "100%",
            resize: "none",
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: "8px 10px",
          }}
        />
      </div>
    </div>
  );
}
