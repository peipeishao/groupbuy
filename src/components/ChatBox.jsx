// src/components/ChatBox.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase.js";
import { onValue, push, ref, serverTimestamp } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";

export default function ChatBox() {
  const player = usePlayer();
  const uid = player?.uid || "dev-local";
  const roleName = player?.roleName || player?.profile?.name || "旅人"; // ✅ 統一顯示角色名稱
  const setBubble = player?.setBubble;

  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);

  // 訂閱訊息
  useEffect(() => {
    const off = onValue(ref(db, "chat/global"), (snap) => {
      const v = snap.val() || {};
      const arr = Object.entries(v)
        .map(([id, m]) => ({ id, ...m }))
        // ✅ RTDB 的 serverTimestamp() 會變成「毫秒數字」，不是 Firestore 的 {seconds}
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
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
      roleName, // ✅ 存公開名稱（不存 realName）
      text: t,
      ts: serverTimestamp(),
    });
    if (typeof setBubble === "function") {
      await setBubble(t);
    }
    setText("");
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {msgs.map((m) => (
          <div key={m.id} style={{ marginBottom: 6 }}>
            <b>{m.roleName || "旅人"}：</b> {m.text}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", borderTop: "1px solid #eee" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={`以「${roleName}」身分發話…`}
          style={{ flex: 1, border: "none", padding: 10 }}
        />
        <button onClick={send} style={{ padding: "10px 14px" }}>
          送出
        </button>
      </div>
    </div>
  );
}
