// src/components/ReviewBox.jsx
import React, { useState } from "react";
import { ref, push, serverTimestamp, get, set } from "firebase/database";
import { db } from "../firebase";
import { usePlayer } from "../store/playerContext";

export default function ReviewBox({ stallId }) {
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const { uid, profile, addCoins } = usePlayer();

  const submit = async () => {
    if (!text.trim()) return;
    await push(ref(db, `reviews/${stallId}`), {
      uid,
      name: profile.name,
      rating,
      text,
      ts: serverTimestamp(),
    });

    const key = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const progRef = ref(db, `progress/${uid}/review_once_${key}`);
    const snap = await get(progRef);
    if (!snap.exists()) {
      await set(progRef, { done: true, ts: Date.now() });
      await addCoins(10);
      alert("感謝評論！+10 金幣");
    }
    setText("");
  };

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <select value={rating} onChange={(e) => setRating(+e.target.value)}>
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n}★
          </option>
        ))}
      </select>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="寫下你的評論…"
        style={{ flex: 1 }}
      />
      <button onClick={submit}>送出</button>
    </div>
  );
}

