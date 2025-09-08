// src/components/ChatBox.jsx
import React, { useEffect, useRef, useState } from "react";
import { db, auth } from "../firebase.js";
import { ref as dbRef, push, set, onValue, limitToLast, query } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";

export default function ChatBox() {
  const { roleName, openLoginGate } = usePlayer() || {};
  const [list, setList] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const boxRef = useRef(null);

  // 讀取最後 50 則訊息（需要登入，否則後端規則會擋）
  useEffect(() => {
    const qRef = query(dbRef(db, "chat/global"), limitToLast(50));
    const off = onValue(
      qRef,
      (snap) => {
        const v = snap.val() || {};
        const arr = Object.entries(v).map(([id, m]) => ({ id, ...(m || {}) }));
        arr.sort((a, b) => (a.ts || 0) - (b.ts || 0));
        setList(arr);
        // 捲到底
        requestAnimationFrame(() => {
          boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
        });
      },
      (e) => {
        console.error("[ChatBox] read error:", e);
      }
    );
    return () => off();
  }, []);

  const send = async () => {
    const t = String(text || "").trim();
    if (!t) return;

    // 必須登入（含匿名）。沒登入就打開 LoginGate，再讓使用者重試。
    const u = auth.currentUser;
    if (!u) {
      openLoginGate?.();
      return;
    }

    // 依規則：uid 必須等於 auth.uid；roleName 最長 20；text 長度 1~500
    const msg = {
      uid: u.uid,
      roleName: String(roleName || "玩家").slice(0, 20),
      text: t.slice(0, 500),
      ts: Date.now(),
    };

    setSending(true);
    try {
      const id = push(dbRef(db, "chat/global")).key;
      await set(dbRef(db, `chat/global/${id}`), msg);

      // 頭頂氣泡（大家都看得到）
      await set(dbRef(db, `playersPublic/${u.uid}/bubble`), { text: msg.text, ts: msg.ts });
      // 3 秒後清掉
      setTimeout(() => {
        set(dbRef(db, `playersPublic/${u.uid}/bubble`), null).catch(() => {});
      }, 3000);

      setText("");
      // 捲到底
      requestAnimationFrame(() => {
        boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch (e) {
      console.error("[ChatBox] write error:", e);
      alert("傳送失敗：" + (e?.message || "請稍後再試"));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending) send();
    }
  };

  return (
    <div style={wrap}>
      <div ref={boxRef} style={listBox}>
        {list.map((m) => (
          <div key={m.id} style={{ marginBottom: 6 }}>
            <b style={{ color: "#334155" }}>{m.roleName || "玩家"}</b>
            <span style={{ color: "#94a3b8", marginLeft: 6, fontSize: 12 }}>
              {m.ts ? new Date(m.ts).toLocaleTimeString() : ""}
            </span>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
          </div>
        ))}
      </div>

      <div style={inputRow}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="輸入訊息，按 Enter 送出（Shift+Enter 換行）"
          rows={2}
          style={ta}
        />
        <button onClick={send} disabled={sending} style={btn}>
          送出
        </button>
      </div>
    </div>
  );
}

/* styles */
const wrap = { width: 320, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.08)" };
const listBox = { height: 220, overflowY: "auto", padding: "10px 12px", borderBottom: "1px solid #e5e7eb" };
const inputRow = { padding: 8, display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" };
const ta = { width: "100%", resize: "none", padding: 8, border: "1px solid #e5e7eb", borderRadius: 8, fontFamily: "inherit" };
const btn = { padding: "8px 12px", borderRadius: 10, border: "2px solid #111", background: "#fff", fontWeight: 900, cursor: "pointer" };
