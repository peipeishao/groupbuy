// src/components/ChatBox.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase.js";
import { onValue, push, ref, serverTimestamp } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";

export default function ChatBox() {
  const { uid, profile, setBubble } = usePlayer();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");  // ✅ 這裡是 text
  const listRef = useRef(null);

  // 訂閱訊息
  useEffect(() => {
    const off = onValue(ref(db, "chat/global"), (snap) => {
      const v = snap.val() || {};
      const arr = Object.entries(v)
        .map(([id, m]) => ({ id, ...m }))
        .sort((a, b) => (a.ts?.seconds || 0) - (b.ts?.seconds || 0));
      setMsgs(arr);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    });
    return () => off();
  }, []);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    await push(ref(db, "chat/global"), {
      uid,
      name: profile.name || "旅人",
      text: t,
      ts: serverTimestamp(),
    });
    await setBubble(t);
    setText(""); // 清空輸入框
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {msgs.map((m) => (
          <div key={m.id} style={{ marginBottom: 6 }}>
            <b>{m.name || "旅人"}：</b> {m.text}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", borderTop: "1px solid #eee" }}>
        <input
          value={text}                  // ✅ 改成 text
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="輸入訊息…"
          style={{ flex: 1, border: "none", padding: 10 }}
        />
        <button onClick={send} style={{ padding: "10px 14px" }}>
          送出
        </button>
      </div>
    </div>
  );
}
