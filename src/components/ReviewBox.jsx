// src/components/ReviewBox.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase.js";
import { ref, push, serverTimestamp } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";

export default function ReviewBox({ itemId, onDone }) {
  const { isAnonymous, openLoginGate, uid, roleName, avatar } = usePlayer();
  const [text, setText] = useState("");
  const [stars, setStars] = useState(5);
  const [saving, setSaving] = useState(false);

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
      openLoginGate({ mode: "upgrade", next: "review" });
      return;
    }
    postReview();
  };

  return (
    <div style={{ background: "#fff", padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
      <div style={{ marginBottom: 6, fontWeight: 800 }}>寫評論</div>
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
