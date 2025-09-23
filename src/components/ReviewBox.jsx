// src/components/ReviewBox.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { ref, push, serverTimestamp, onValue, off as dbOff } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";

export default function ReviewBox({ itemId, onDone }) {
  const { isAnonymous, openLoginGate, uid, roleName, avatar } = usePlayer() || {};
  const [text, setText] = useState("");
  const [stars, setStars] = useState(5);
  const [saving, setSaving] = useState(false);

  // 🔎 即時顯示「目前評論數量＋平均星數」
  const [count, setCount] = useState(0);
  const [avg, setAvg] = useState(0);

  useEffect(() => {
    if (!itemId) return;
    const r = ref(db, `reviews/${itemId}`);
    const unsub = onValue(r, (snap) => {
      const v = snap.val() || {};
      const arr = Object.values(v);
      const c = arr.length;
      const s = c ? arr.reduce((sum, r) => sum + (Number(r?.stars) || 0), 0) / c : 0;
      setCount(c);
      setAvg(s);
    });
    return () => { try { dbOff(r, "value", unsub); } catch {} };
  }, [itemId]);

  const postReview = async () => {
    if (saving || !text.trim()) return;
    try {
      setSaving(true);
      const reviewsRef = ref(db, `reviews/${itemId}`);
      await push(reviewsRef, {
        uid,
        author: { uid, roleName, avatar },
        text: text.trim(),
        stars: Number(stars) || 5,
        ts: serverTimestamp(),
      });
      setText("");
      setStars(5);
      onDone?.();
      alert("已送出評論！");
    } catch (err) {
      console.error(err);
      alert("送出失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onOk = (e) => {
      if (e?.detail?.next === "review") postReview();
    };
    window.addEventListener("login-success", onOk);
    return () => window.removeEventListener("login-success", onOk);
  }, [text, stars, uid, roleName, avatar, saving]);

  const handleSubmit = () => {
    if (isAnonymous) {
      openLoginGate?.({ mode: "upgrade", next: "review" });
      return;
    }
    postReview();
  };

  return (
    <div style={{ background: "#fff", padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
      {/* ✅ 在寫評論區塊就能看到摘要 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontWeight: 800 }}>寫評論</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          平均 {avg.toFixed(1)} ★ ・ 共 {count} 則
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span>評分：</span>
        <select value={stars} onChange={(e) => setStars(e.target.value)}>
          {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} ★</option>)}
        </select>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="說說你的看法…"
        rows={3}
        style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, gap: 8 }}>
        <button onClick={() => { setText(""); setStars(5); }} disabled={saving}>清空</button>
        <button
          onClick={handleSubmit}
          disabled={saving || !text.trim()}
          style={{ border: "2px solid #333", background: "#fff", borderRadius: 10, padding: "8px 14px", fontWeight: 800 }}
        >
          {saving ? "送出中…" : "送出評論"}
        </button>
      </div>
    </div>
  );
}
