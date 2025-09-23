// src/components/ChatBox.jsx
import React, { useEffect, useRef, useState, useRef as useRefAlias } from "react";
import { usePlayer } from "../store/playerContext.jsx";
import { db, auth } from "../firebase.js";
import {
  ref as dbRef,
  push,
  set,
  query,
  limitToLast,
  onChildAdded,
  off as dbOff,
} from "firebase/database";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

const MAX_HISTORY = 100;

export default function ChatBox() {
  const { uid, roleName = "旅人" } = usePlayer() || {};
  const [ready, setReady] = useState(false);
  const [list, setList] = useState([]); // [{id, uid, roleName, text, ts}]
  const [text, setText] = useState("");
  const boxRef = useRef(null);

  // 保存目前的訊息id，避免同一訊息重複加入（例如重複綁訂閱）
  const seenIdsRef = useRefAlias(new Set());
  // 保存目前的 onChildAdded 監聽，用於切換登入狀態時先解除舊的
  const childListenerRef = useRefAlias(null);
  const queryRefRef = useRefAlias(null);
  const authUnsubRef = useRefAlias(null);

  useEffect(() => {
    // 確保匿名也會登入，並避免重複綁定監聽
    authUnsubRef.current = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) { await signInAnonymously(auth); return; }

        setReady(true);

        // 先解除舊的監聽，避免重複
        if (queryRefRef.current && childListenerRef.current) {
          try { dbOff(queryRefRef.current, "child_added", childListenerRef.current); } catch {}
          childListenerRef.current = null;
          queryRefRef.current = null;
        }

        // 重設去重集合（以免殘留）
        seenIdsRef.current.clear();

        const q = query(dbRef(db, "chat/global"), limitToLast(MAX_HISTORY));
        queryRefRef.current = q;

        const handler = (snap) => {
          const id = snap.key;
          if (!id || seenIdsRef.current.has(id)) return;

          const v = snap.val() || {};
          if (!v?.text) return;

          seenIdsRef.current.add(id);
          setList((old) => [...old, { id, ...v }]);
        };

        childListenerRef.current = handler;
        onChildAdded(q, handler, (err) => console.warn("[chat] subscribe error:", err));
      } catch (e) {
        console.error("[chat] auth error:", e);
      }
    });

    return () => {
      // 清除監聽
      try {
        if (queryRefRef.current && childListenerRef.current) {
          dbOff(queryRefRef.current, "child_added", childListenerRef.current);
        }
      } catch {}
      try { authUnsubRef.current?.(); } catch {}
    };
  }, []);

  // 新訊息自動捲到底
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight + 9999;
  }, [list.length]);

  async function send() {
    const t = String(text || "").trim();
    if (!t) return;
    if (!ready || !auth.currentUser) return;
    try {
      // 寫入聊天室（不做樂觀更新，避免自我重複）
      await push(dbRef(db, "chat/global"), {
        uid: auth.currentUser.uid,
        roleName,
        text: t,
        ts: Date.now(),
      });
      setText("");

      // 寫入頭頂氣泡（3 秒後清空）
      const my = auth.currentUser.uid;
      await set(dbRef(db, `playersPublic/${my}/bubble`), { text: t, ts: Date.now() });
      setTimeout(() => {
        set(dbRef(db, `playersPublic/${my}/bubble`), null);
      }, 3000);
    } catch (e) {
      console.error("[chat] send failed:", e);
      alert("訊息發送失敗，請稍後再試");
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const wrap = {
    width: 360,
    background: "rgba(255,255,255,.96)",
    border: "1px solid #eee",
    borderRadius: 16,
    boxShadow: "0 12px 28px rgba(0,0,0,.12)",
  };

  return (
    <div style={wrap}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid #eee", background: "#f9fafb", borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
        <b>聊天室</b>
      </div>
      <div ref={boxRef} style={{ height: 220, overflow: "auto", padding: 10 }}>
        {list.length === 0 ? (
          <div style={{ color: "#777", fontSize: 12 }}>尚無訊息，打聲招呼吧！</div>
        ) : (
          list.map((m) => {
            const mine = m.uid === auth.currentUser?.uid;
            return (
              <div key={m.id} style={{ margin: "6px 0", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div
                  title={new Date(m.ts || Date.now()).toLocaleString()}
                  style={{
                    padding: "6px 8px",
                    background: mine ? "#111827" : "#fff",
                    color: mine ? "#fff" : "#111",
                    border: mine ? "0" : "1px solid #eee",
                    borderRadius: 10,
                    maxWidth: 280,
                    wordBreak: "break-word",
                  }}
                >
                  <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{m.roleName || "旅人"}</div>
                  <div>{m.text}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div style={{ display: "flex", gap: 6, padding: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={ready ? "輸入訊息，Enter 送出" : "連線中…"}
          style={{ flex: 1, padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10 }}
        />
        <button
          onClick={send}
          disabled={!ready || !text.trim()}
          style={{ padding: "10px 12px", borderRadius: 10, border: "2px solid #333", background: "#fff", fontWeight: 800, cursor: "pointer" }}
        >
          送出
        </button>
      </div>
    </div>
  );
}
