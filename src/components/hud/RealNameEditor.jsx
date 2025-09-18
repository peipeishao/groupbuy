import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebase.js";
import { ref, onValue, set } from "firebase/database";

export default function RealNameEditor({ onSaved }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const off = onValue(ref(db, `playersPrivate/${uid}/realName`), (snap) => {
      setValue(String(snap.val() || ""));
      setLoading(false);
    }, () => setLoading(false));
    return () => off();
  }, [uid]);

  const handleSave = async () => {
    if (!uid) return;
    const trimmed = value.trim();
    if (trimmed.length > 50) {
      alert("真實姓名長度請在 50 字內");
      return;
    }
    try {
      setSaving(true);
      await set(ref(db, `playersPrivate/${uid}/realName`), trimmed || "");
      onSaved?.(trimmed);
      alert("真實姓名已更新");
    } catch (e) {
      console.error(e);
      alert("儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 6 }}>
        真實姓名（只供店家對帳用，不對外顯示）
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="請輸入真實姓名"
          disabled={loading || saving}
          style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" }}
        />
        <button
          onClick={handleSave}
          disabled={loading || saving}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #0f172a", background: "#fff", fontWeight: 700 }}
        >
          {saving ? "儲存中…" : "儲存"}
        </button>
      </div>
    </div>
  );
}
