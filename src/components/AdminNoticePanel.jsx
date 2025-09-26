// src/components/AdminNoticePanel.jsx
import React from "react";
import { ref, onValue, set, remove } from "firebase/database";
import { db } from "../firebase";
import { usePlayer } from "../store/playerContext.jsx";

export default function AdminNoticePanel() {
  let player = null;
  try { player = usePlayer(); } catch {}
  const isAdmin = !!player?.isAdmin;

  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // 讀取公告
  React.useEffect(() => {
    const off = onValue(ref(db, "announcements/ordersSummary"), (snap) => {
      const v = snap.val();
      setText((v && typeof v.text === "string") ? v.text : "");
    });
    return () => off();
  }, []);

  const save = async () => {
    if (!isAdmin) { alert("需要管理員權限"); return; }
    setSaving(true);
    try {
      await set(ref(db, "announcements/ordersSummary"), {
        text: String(text || "").slice(0, 500),
        ts: Date.now(),
      });
      alert("已更新公告！");
    } catch (e) {
      console.error("[AdminNoticePanel] save", e);
      alert("儲存失敗，請稍後再試");
    } finally { setSaving(false); }
  };

  const clearAll = async () => {
    if (!isAdmin) { alert("需要管理員權限"); return; }
    if (!window.confirm("確定要清除公告內容嗎？")) return;
    try {
      await remove(ref(db, "announcements/ordersSummary"));
      setText("");
      alert("已清除公告！");
    } catch (e) {
      console.error("[AdminNoticePanel] clear", e);
      alert("清除失敗，請稍後再試");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>
        訂單總覽公告（顯示在 OrdersSummaryTable 頂部，前綴 📣）
      </div>
      <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>
        支援換行，最多 500 字。
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="請輸入要顯示在訂單總覽頂部的公告內容…"
        maxLength={500}
        style={{
          width: "100%",
          minHeight: 120,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: "10px 14px", borderRadius: 10, border: "2px solid #16a34a", background: "#fff", color: "#16a34a", fontWeight: 800, cursor: "pointer" }}
        >
          {saving ? "儲存中…" : "儲存公告"}
        </button>
        <button
          onClick={clearAll}
          style={{ padding: "10px 14px", borderRadius: 10, border: "2px solid #9ca3af", background: "#fff", color: "#374151", fontWeight: 800, cursor: "pointer" }}
        >
          清除公告
        </button>
      </div>
    </div>
  );
}
