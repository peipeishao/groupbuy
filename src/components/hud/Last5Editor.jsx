// src/components/hud/Last5Editor.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../firebase.js";
import { ref as rRef, update as rUpdate } from "firebase/database";
import { usePlayer } from "../../store/playerContext.jsx";

export default function Last5Editor() {
  const player = usePlayer();
  const uid = player?.user?.uid || null;
  const [val, setVal] = useState(String(player?.last5 || player?.profile?.last5 || ""));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setVal(String(player?.last5 || player?.profile?.last5 || ""));
  }, [player?.last5, player?.profile?.last5]);

  const onChange = (e) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D+/g, "").slice(0, 5);
    setVal(digits);
  };

  const onSave = async () => {
    if (!uid) return;
    if (!/^\d{5}$/.test(val)) { setMsg("請輸入 5 碼數字"); return; }
    setSaving(true);
    try {
      await rUpdate(rRef(db, `players/${uid}`), { last5: val, updatedAt: Date.now() });
      setMsg("已更新末五碼");
    } catch (e) {
      console.error("[Last5Editor] save failed:", e);
      setMsg("儲存失敗，請稍後再試");
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ fontWeight: 900, marginBottom: 6 }}>匯款末五碼</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          inputMode="numeric"
          pattern="\d*"
          placeholder="例如：12345"
          value={val}
          onChange={onChange}
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#fff",
            letterSpacing: 2,
            fontVariantNumeric: "tabular-nums",
          }}
          maxLength={5}
        />
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            padding: "10px 12px",
            border: "2px solid #0ea5e9",
            borderRadius: 10,
            background: "#fff",
            color: "#0ea5e9",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {saving ? "儲存中…" : "儲存"}
        </button>
      </div>
      {msg && <div style={{ marginTop: 6, fontSize: 12, color: "#0f766e" }}>{msg}</div>}
    </div>
  );
}
