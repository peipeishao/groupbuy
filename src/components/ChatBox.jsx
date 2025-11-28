// src/components/ChatBox.jsx
import React, {
  useEffect,
  useRef,
  useState,
  useRef as useRefAlias,
} from "react";
import { usePlayer } from "../store/playerContext.jsx";
import { db, auth } from "../firebase.js";
import {
  ref as dbRef,
  push,
  set,
  query,
  limitToLast,
  onChildAdded,
  onChildChanged,
  off as dbOff,
} from "firebase/database";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

// Emoji 選擇器
import EmojiPicker from "emoji-picker-react";

const MAX_HISTORY = 100;

export default function ChatBox() {
  const { uid, roleName = "旅人" } = usePlayer() || {};
  const [ready, setReady] = useState(false);
  const [list, setList] = useState([]); // [{id, uid, roleName, text, ts, reactions?}]
  const [text, setText] = useState("");

  // 輸入框旁的 emoji 選單
  const [showEmoji, setShowEmoji] = useState(false);

  // 訊息反應：目前選擇要加反應的訊息
  const [reactionTargetId, setReactionTargetId] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // 滑鼠目前 hover 的訊息（用來顯示 Discord 風反應按鈕）
  const [hoveredMsgId, setHoveredMsgId] = useState(null);

  // 反應用 emoji picker 要出現的位置（相對整個 ChatBox）
  const [reactionPickerPos, setReactionPickerPos] = useState({
    top: 0,
    left: 0,
  });

  const boxRef = useRef(null);

  // 去重：避免同一筆訊息加到 list 兩次
  const seenIdsRef = useRefAlias(new Set());
  const queryRefRef = useRefAlias(null);
  const childAddedListenerRef = useRefAlias(null);
  const childChangedListenerRef = useRefAlias(null);
  const authUnsubRef = useRefAlias(null);

  const myUid = auth.currentUser?.uid || uid || null;

  // -------------------------
  // Firebase 訂閱 & 登入
  // -------------------------
  useEffect(() => {
    authUnsubRef.current = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          await signInAnonymously(auth);
          return;
        }

        setReady(true);

        // 先解除舊的監聽
        if (queryRefRef.current) {
          try {
            if (childAddedListenerRef.current) {
              dbOff(
                queryRefRef.current,
                "child_added",
                childAddedListenerRef.current
              );
            }
            if (childChangedListenerRef.current) {
              dbOff(
                queryRefRef.current,
                "child_changed",
                childChangedListenerRef.current
              );
            }
          } catch {}
          childAddedListenerRef.current = null;
          childChangedListenerRef.current = null;
          queryRefRef.current = null;
        }

        seenIdsRef.current.clear();

        const q = query(dbRef(db, "chat/global"), limitToLast(MAX_HISTORY));
        queryRefRef.current = q;

        // 新訊息
        const handleAdded = (snap) => {
          const id = snap.key;
          if (!id) return;
          if (seenIdsRef.current.has(id)) return;

          const v = snap.val() || {};
          if (!v?.text) return;

          seenIdsRef.current.add(id);
          setList((old) => [...old, { id, ...v }]);
        };

        // 訊息被修改（例如：reactions 變動）
        const handleChanged = (snap) => {
          const id = snap.key;
          if (!id) return;
          const v = snap.val() || {};
          if (!v?.text) return;

          setList((old) => {
            const idx = old.findIndex((m) => m.id === id);
            if (idx === -1) {
              return [...old, { id, ...v }];
            }
            const copy = [...old];
            copy[idx] = { id, ...v };
            return copy;
          });
        };

        childAddedListenerRef.current = handleAdded;
        childChangedListenerRef.current = handleChanged;

        onChildAdded(q, handleAdded, (err) =>
          console.warn("[chat] child_added error:", err)
        );
        onChildChanged(q, handleChanged, (err) =>
          console.warn("[chat] child_changed error:", err)
        );
      } catch (e) {
        console.error("[chat] auth error:", e);
      }
    });

    return () => {
      try {
        if (queryRefRef.current) {
          if (childAddedListenerRef.current) {
            dbOff(
              queryRefRef.current,
              "child_added",
              childAddedListenerRef.current
            );
          }
          if (childChangedListenerRef.current) {
            dbOff(
              queryRefRefRef.current,
              "child_changed",
              childChangedListenerRef.current
            );
          }
        }
      } catch {}
      try {
        authUnsubRef.current?.();
      } catch {}
    };
  }, []);

  // -------------------------
  // 新訊息自動捲到底
  // -------------------------
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight + 9999;
  }, [list.length]);

  // -------------------------
  // 發送訊息
  // -------------------------
  async function send() {
    const t = String(text || "").trim();
    if (!t) return;
    if (!ready || !auth.currentUser) return;
    try {
      const nowUid = auth.currentUser.uid;

      await push(dbRef(db, "chat/global"), {
        uid: nowUid,
        roleName,
        text: t,
        ts: Date.now(),
      });
      setText("");
      setShowEmoji(false);

      // 頭頂氣泡
      await set(dbRef(db, `playersPublic/${nowUid}/bubble`), {
        text: t,
        ts: Date.now(),
      });
      setTimeout(() => {
        set(dbRef(db, `playersPublic/${nowUid}/bubble`), null);
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

  // -------------------------
  // 輸入列：點選 emoji（插入文字）
  // -------------------------
  function onEmojiClickForInput(emojiData) {
    setText((prev) => prev + emojiData.emoji);
  }

  // -------------------------
  // 訊息反應：加/移除某個 emoji
  // -------------------------
  async function toggleReaction(messageId, emoji) {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;

    let willReact = false;

    // 先本地更新（看起來比較即時）
    setList((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;

        const reactions = { ...(m.reactions || {}) };
        const users = { ...(reactions[emoji] || {}) };
        const hasReacted = !!users[userId];

        willReact = !hasReacted;

        if (hasReacted) {
          delete users[userId];
        } else {
          users[userId] = true;
        }

        if (Object.keys(users).length === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = users;
        }

        return { ...m, reactions };
      })
    );

    try {
      const rRef = dbRef(
        db,
        `chat/global/${messageId}/reactions/${emoji}/${userId}`
      );
      if (willReact) {
        await set(rRef, true);
      } else {
        await set(rRef, null);
      }
    } catch (e) {
      console.error("[chat] toggleReaction failed:", e);
    }
  }

  const wrap = {
    width: 360,
    background: "rgba(255,255,255,.96)",
    border: "1px solid #eee",
    borderRadius: 16,
    boxShadow: "0 12px 28px rgba(0,0,0,.12)",
    position: "relative",
  };

  return (
    <div style={wrap} data-chatbox-root>
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid #eee",
          background: "#f9fafb",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        <b>聊天室</b>
      </div>

      {/* 訊息列表 */}
      <div ref={boxRef} style={{ height: 220, overflow: "auto", padding: 10 }}>
        {list.length === 0 ? (
          <div style={{ color: "#777", fontSize: 12 }}>
            尚無訊息，打聲招呼吧！
          </div>
        ) : (
          list.map((m) => {
            const mine = m.uid === auth.currentUser?.uid;
            const reactions = m.reactions || {};
            const emojiKeys = Object.keys(reactions);
            const hasReactions = emojiKeys.length > 0;

            // 這個訊息是否是目前的 emoji 選單目標
            const isTarget = reactionTargetId === m.id && showReactionPicker;

            return (
              <div
                key={m.id}
                style={{
                  margin: "6px 0",
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  position: "relative", // 給 hover 按鈕用
                }}
                onMouseEnter={() => setHoveredMsgId(m.id)}
                onMouseLeave={() => {
                  setHoveredMsgId((prev) => (prev === m.id ? null : prev));
                }}
              >
                {/* 滑過訊息才出現的「新增反應」小按鈕（左下角） */}
                {hoveredMsgId === m.id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      const root = e.currentTarget.closest(
                        "[data-chatbox-root]"
                      );
                      if (root) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const rootRect = root.getBoundingClientRect();
                        // 讓 emoji 視窗出現在按鈕的左下附近
                        setReactionPickerPos({
                           top: rect.top - rootRect.top,
                          left:
                            rect.left -
                            rootRect.left +
                            rect.width * 0.2, // 稍微偏左一點
                        });
                      }
                      setReactionTargetId(m.id);
                      setShowReactionPicker(true);
                      setShowEmoji(false);
                    }}
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      transform: "translate(0, -20px)", // 按鈕在泡泡左下角附近
                      padding: "2px 6px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      background: "#ffffff",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.12)",
                      cursor: "pointer",
                      fontSize: 14,
                      opacity: 0.9,
                      zIndex: 2500,
                    }}
                  >
                    🙂
                  </button>
                )}

                {/* 訊息泡泡 + reactions */}
                <div
                  style={{
                    maxWidth: 280,
                  }}
                >
                  {/* 氣泡本體 */}
                  <div
                    title={new Date(m.ts || Date.now()).toLocaleString()}
                    style={{
                      padding: "6px 8px",
                      background: mine ? "#111827" : "#fff",
                      color: mine ? "#fff" : "#111",
                      border: mine ? "0" : "1px solid #eee",
                      borderRadius: 10,
                      wordBreak: "break-word",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.7,
                        marginBottom: 2,
                      }}
                    >
                      {m.roleName || "旅人"}
                    </div>
                    <div>{m.text}</div>
                  </div>

                  {/* 表情反應列 */}
                  {hasReactions && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 4,
                        fontSize: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      {emojiKeys.map((emoji) => {
                        const userMap = reactions[emoji] || {};
                        const count = Object.keys(userMap).length;
                        if (count === 0) return null;

                        const reacted = !!(myUid && userMap[myUid]);

                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleReaction(m.id, emoji)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 6px",
                              borderRadius: 999,
                              border: reacted
                                ? "1px solid #2563eb"
                                : "1px solid #ddd",
                              background: reacted ? "#eff6ff" : "#f9fafb",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            <span>{emoji}</span>
                            <span style={{ fontSize: 11 }}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 底部輸入區 */}
      <div style={{ display: "flex", gap: 6, padding: 10, position: "relative" }}>
        {/* Emoji 按鈕（輸入文字用） */}
        <button
          type="button"
          onClick={() => {
            setShowEmoji((prev) => !prev);
            setShowReactionPicker(false);
            setReactionTargetId(null);
          }}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          😊
        </button>

        {/* 輸入框的 Emoji 選單 */}
        {showEmoji && (
          <div
            style={{
              position: "absolute",
              bottom: "55px",
              left: "10px",
              zIndex: 3000,
            }}
          >
            <EmojiPicker
              onEmojiClick={onEmojiClickForInput}
              autoFocusSearch={false}
              previewConfig={{ showPreview: false }}
            />
          </div>
        )}

        {/* 輸入框 */}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={ready ? "輸入訊息，Enter 送出" : "連線中…"}
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 10,
          }}
        />

        {/* 送出按鈕 */}
        <button
          onClick={send}
          disabled={!ready || !text.trim()}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "2px solid #333",
            background: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          送出
        </button>
      </div>

      {/* 全局定位的 EmojiPicker（不會被 overflow 擋住） */}
      {showReactionPicker && reactionTargetId && (
        <div
          style={{
            position: "absolute",
            top: reactionPickerPos.top,
            left: reactionPickerPos.left,
            transform: "translate(-10px, -100%)",
            zIndex: 5000,
            background: "#ffffff",
            borderRadius: 8,
            boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
          }}
        >
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              toggleReaction(reactionTargetId, emojiData.emoji);
              setShowReactionPicker(false);
              setReactionTargetId(null);
            }}
            autoFocusSearch={false}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </div>
  );
}
