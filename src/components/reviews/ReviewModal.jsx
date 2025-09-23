// src/components/reviews/ReviewModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase.js";
import { ref as dbRef, onValue, push, set, remove, off as dbOff } from "firebase/database";
import { usePlayer } from "../../store/playerContext.jsx";

export default function ReviewModal({ open, itemId, itemName, onClose }) {
  const player = usePlayer();
  const { uid, roleName, avatar, isAnonymous, openLoginGate, user, isAdmin } = player || {};
  const [list, setList] = useState([]);
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || !itemId) return;

    setErr("");
    const ref = dbRef(db, `reviews/${itemId}`);
    const unsub = onValue(
      ref,
      (snap) => {
        const v = snap.val() || {};
        const arr = Object.entries(v).map(([id, r]) => ({ id, ...(r || {}) }));
        arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        setList(arr);
      },
      (e) => {
        console.error("[ReviewModal] read error:", e);
        setErr("讀取評論失敗，請稍後重試");
      }
    );

    return () => {
      try { dbOff(ref, "value", unsub); } catch {}
    };
  }, [open, itemId]);

  const avg = useMemo(() => {
    if (!list.length) return 0;
    return list.reduce((s, r) => s + (Number(r.stars) || 0), 0) / list.length;
  }, [list]);

  const submit = async () => {
    setErr("");

    if (!uid || !user || isAnonymous) {
      openLoginGate?.();
      return;
    }

    const t = String(text || "").trim();
    const s = Number(stars);
    if (!s || s < 1 || s > 5) { setErr("請選擇 1–5 星"); return; }
    if (!t) { setErr("請輸入評論文字"); return; }

    setSending(true);
    try {
      const parent = dbRef(db, `reviews/${itemId}`);
      const rid = push(parent).key;
      const review = {
        uid,
        author: { uid, roleName: roleName || "玩家", avatar: avatar || "bunny" },
        text: t,
        stars: s,
        ts: Date.now(),
      };
      await set(dbRef(db, `reviews/${itemId}/${rid}`), review);

      // ❌ 不再做「樂觀更新」，交給 onValue 來統一刷新，避免暫時性重複
      setText("");
      setStars(5);
    } catch (e) {
      console.error("[ReviewModal] write error:", e);
      setErr("送出評論失敗：" + (e?.message || "請稍後再試"));
    } finally {
      setSending(false);
    }
  };

  const canDelete = (r) => !!uid && (String(r.uid) === String(uid) || !!isAdmin);

  const onDelete = async (r) => {
    if (!canDelete(r)) return;
    const ok = window.confirm("確定刪除這則評論嗎？此動作無法復原。");
    if (!ok) return;
    try {
      await remove(dbRef(db, `reviews/${itemId}/${r.id}`));
      // 不做本地移除，讓 onValue 接手；或保留也可，但保持單一資料來源較穩
    } catch (e) {
      console.error("[ReviewModal] delete error:", e);
      alert("刪除失敗：" + (e?.message || "請稍後再試"));
    }
  };

  if (!open) return null;

  return (
    <div onClick={onClose} style={wrap}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={head}>
          <b>評論：{itemName}</b>
          <button onClick={onClose} style={xBtn}>×</button>
        </div>

        <div style={{ padding: 12 }}>
          {/* 摘要 */}
          <div style={{ marginBottom: 10 }}>
            平均：{avg.toFixed(1)} ★　/　共 {list.length} 則評論
          </div>

          {/* 發表（未登入也能看；送出時才引導登入） */}
          <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <select value={stars} onChange={(e) => setStars(Number(e.target.value))}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} 星</option>)}
              </select>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={!uid || isAnonymous ? "登入後即可留言（仍可瀏覽評論）" : "寫下你的心得…"}
                style={{ flex: 1, minWidth: 240, padding: "8px 10px", border: "1px solid #ddd", borderRadius: 10 }}
              />
              <button onClick={submit} disabled={sending} style={sendBtn}>
                {sending ? "送出中…" : "送出"}
              </button>
            </div>
            {err && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>{err}</div>}
          </div>

          {/* 清單 */}
          {list.length === 0 ? (
            <div style={{ color: "#64748b" }}>還沒有評論，成為第一個評論的人吧！</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {list.map((r) => (
                <div key={r.id} style={{ border: "1px solid #f1f5f9", borderRadius: 12, padding: 10 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <div style={{ fontWeight: 900 }}>{r.author?.roleName || "玩家"}</div>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>
                      {r.ts ? new Date(r.ts).toLocaleString() : ""}
                    </div>
                    <div style={{ marginLeft: "auto" }}>
                      <span style={{ marginRight: 8 }}>{(r.stars || 0)} ★</span>
                      {canDelete(r) && (
                        <button onClick={() => onDelete(r)} style={delBtn} title="刪除這則評論">
                          刪除
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{r.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* styles */
const wrap = { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 2000, display: "grid", placeItems: "center", padding: 12 };
const panel = { width: "min(760px,96vw)", background: "#fff", border: "1px solid #eee", borderRadius: 16, boxShadow: "0 20px 48px rgba(0,0,0,.2)", overflow: "hidden" };
const head = { padding: "8px 14px", background: "#f9fafb", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" };
const xBtn = { padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" };
const sendBtn = { padding: "8px 12px", borderRadius: 10, border: "2px solid #111", background: "#fff", fontWeight: 900, cursor: "pointer" };
const delBtn = { padding: "6px 10px", borderRadius: 8, border: "2px solid #ef4444", background: "#fff", color: "#ef4444", fontWeight: 900, cursor: "pointer" };
