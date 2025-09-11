// src/components/AnnouncementBar.jsx — v3 (穩健/含 log)
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase.js";
import { ref, query, limitToLast, onChildAdded } from "firebase/database";

export default function AnnouncementBar({ duration = 5000 }) {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);
  const lastKeyRef = useRef(null);

  useEffect(() => {
    const q = query(ref(db, "announcements"), limitToLast(1));
    const off = onChildAdded(q, (snap) => {
      const key = snap.key;
      const val = snap.val() || {};
      if (!val.text) return;

      // 紀錄偵測到的新公告
      // eslint-disable-next-line no-console
      console.log("[AnnouncementBar] onChildAdded:", key, val);

      // 避免 HMR/重複 key 造成無限重播
      if (lastKeyRef.current === key) return;
      lastKeyRef.current = key;

      setMsg(String(val.text));
      setVisible(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), duration);
    });

    return () => {
      clearTimeout(hideTimer.current);
      off();
    };
  }, [duration]);

  const base = {
    position: "fixed",
    top: 8,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "10px 16px",
    background: "rgba(0,0,0,0.78)",
    color: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    pointerEvents: "none",
    transition: "opacity 320ms ease",
    opacity: visible ? 1 : 0,
    zIndex: 9999,
  };

  return (
    <div style={base} aria-live="polite" aria-atomic="true">
      <div style={{ width: 20, height: 20, display: "grid", placeItems: "center", fontSize: 16 }}>📣</div>
      <div style={{ whiteSpace: "pre-wrap" }}>{msg}</div>
    </div>
  );
}
