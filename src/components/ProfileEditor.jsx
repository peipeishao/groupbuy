// src/components/ProfileEditor.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase.js";
import { ref as rRef, update as rUpdate } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";

const AVATAR_PRESETS = [
  { key: "bunny", label: "🐰 兔子" },
  { key: "bear",  label: "🐻 熊" },
  { key: "cat",   label: "🐱 貓" },
  { key: "duck",  label: "🦆 鴨子" },
];

/**
 * 固定區塊順序：
 * 1. 頭像（含預設）→ 下面接 extraAvatarControl
 * 2. 暱稱
 * 3. extraRealName
 * 4. extraLast5
 * 5. extraEmailBinder
 */
export default function ProfileEditor({
  open,
  onClose,
  extraAvatarControl = null, // 上傳頭像按鈕
  extraRealName = null,      // 真實姓名區塊
  extraLast5 = null,         // 末五碼區塊
  extraEmailBinder = null,   // 綁定/修改 Email 區塊
}) {
  const player = usePlayer();
  const uid = player?.user?.uid || null;

  const [avatar, setAvatar] = useState(player?.profile?.avatar || "bunny");
  const [nick, setNick] = useState(player?.roleName || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setAvatar(player?.profile?.avatar || "bunny");
    setNick(player?.roleName || "");
    setMsg("");
  }, [open, player?.profile?.avatar, player?.roleName]);

  if (!open) return null;

  const saveNick = async () => {
    if (!uid) return;
    const name = String(nick || "").trim();
    if (!name) { setMsg("暱稱不可空白"); return; }
    setSaving(true);
    try {
      await rUpdate(rRef(db, `players/${uid}`), {
        roleName: name,
        "profile/roleName": name,
        updatedAt: Date.now(),
      });
      setMsg("已更新暱稱");
    } catch (e) {
      console.error("[ProfileEditor] save nick failed:", e);
      setMsg("儲存失敗，請稍後再試");
    } finally { setSaving(false); }
  };

  const saveAvatar = async (key) => {
    if (!uid) return;
    setSaving(true);
    try {
      setAvatar(key);
      await rUpdate(rRef(db, `players/${uid}/profile`), {
        avatar: key,
        updatedAt: Date.now(),
      });
      setMsg("已更新頭像");
    } catch (e) {
      console.error("[ProfileEditor] save avatar failed:", e);
      setMsg("儲存失敗");
    } finally { setSaving(false); }
  };

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={titleRow}>
          <div style={{ fontWeight: 900 }}>編輯角色</div>
          <button onClick={onClose} style={xBtn} title="關閉">✕</button>
        </div>

        {/* 1) 頭像＋預設 */}
        <section style={card}>
          <div style={secTitle}>頭像</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
            {AVATAR_PRESETS.map((a) => (
              <button
                key={a.key}
                onClick={() => saveAvatar(a.key)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: avatar === a.key ? "2px solid #10b981" : "1px solid #e5e7eb",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 18,
                }}
                title={a.label}
              >
                <div style={{ fontSize: 28, lineHeight: 1 }}>{a.label.split(" ")[0]}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{a.label.split(" ")[1]}</div>
              </button>
            ))}
          </div>

          {/* 頭像下方：上傳頭像按鈕 */}
          {extraAvatarControl && <div style={{ marginTop: 12 }}>{extraAvatarControl}</div>}
        </section>

        {/* 2) 暱稱 */}
        <section style={card}>
          <div style={secTitle}>暱稱</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder="輸入你的暱稱"
              style={input}
            />
            <button onClick={saveNick} disabled={saving} style={primaryBtn}>
              {saving ? "儲存中…" : "儲存"}
            </button>
          </div>
        </section>

        {/* 3) 真實姓名 */}
        {extraRealName && <section style={card}>{extraRealName}</section>}

        {/* 4) 末五碼 */}
        {extraLast5 && <section style={card}>{extraLast5}</section>}

        {/* 5) 綁定 / 修改 Email */}
        {extraEmailBinder && <section style={card}>{extraEmailBinder}</section>}

        {msg && <div style={{ color: "#059669", fontSize: 12, marginTop: 6 }}>{msg}</div>}
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.45)",
  zIndex: 3000,
  display: "grid",
  placeItems: "center",
  padding: 12,
};

const panel = {
  width: "min(720px, 96vw)",
  maxHeight: "min(90vh, 860px)",
  overflow: "auto",
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 16,
  boxShadow: "0 18px 36px rgba(0,0,0,.16)",
  padding: 14,
  display: "grid",
  gap: 12,
};

const titleRow = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const xBtn = { padding: "6px 10px", border: "1px solid #ddd", borderRadius: 10, background: "#fff", fontWeight: 800, cursor: "pointer" };
const card = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#ffffff" };
const secTitle = { fontWeight: 900, marginBottom: 8 };
const input = { flex: 1, padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, background: "#fff" };
const primaryBtn = { padding: "10px 12px", border: "2px solid #10b981", borderRadius: 10, background: "#fff", color: "#10b981", fontWeight: 900, cursor: "pointer" };
