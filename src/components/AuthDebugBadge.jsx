// src/components/AuthDebugBadge.jsx
import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";

export default function AuthDebugBadge() {
  const [uid, setUid] = useState(null);
  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => setUid(u?.uid || null));
    return () => off();
  }, []);
  return (
    <div style={{
      position: "fixed", right: 8, bottom: 8, zIndex: 9999,
      background: "#000a", color: "#fff", padding: "6px 10px",
      borderRadius: 8, fontSize: 12, fontFamily: "monospace"
    }}>
      auth.uid: {uid || "null"}
    </div>
  );
}
