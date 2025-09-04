// src/components/ProfileEditor.jsx
import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase.js";
import { ref as dbRef, update, get } from "firebase/database";

const AVATARS = ["bunny", "bear", "cat", "duck"];
const AVATAR_EMOJI = { bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" };

export default function ProfileEditor({ open, onClose }) {
  const u = auth.currentUser;
  const [loading, setLoading] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [avatar, setAvatar] = useState("bunny");
  const [initDone, setInitDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      if (!u || u.isAnonymous) {
        alert("請先登入");
        onClose?.();
        return;
      }
      // 載入目前 public profile
      const pubSnap = await get(dbRef(db, `playersPublic/${u.uid}`));
      const pub = pubSnap.val() || {};
      setRoleName(pub.roleName || "");
      setAvatar(AVATARS.includes(pub.avatar) ? pub.avatar : "bunny");
      setInitDone(true);
    })();
  }, [open]);

  const canSave = useMemo(() => {
    const name = String(roleName || "").trim();
    return name.length > 0 && name.length <= 20 && AVATARS.includes(avatar);
  }, [roleName, avatar]);

  const onSave = async () => {
    if (!u || u.isAnonymous) return alert("請先登入");
    const name = String(roleName || "").trim();
    if (name.length === 0 || name.length > 20) {
      return alert("角色名稱需為 1–20 字");
    }
    if (!AVATARS.includes(avatar)) {
      return alert("頭像選擇不合法");
    }
    setLoading(true);
    try {
      await update(dbRef(db, `playersPublic/${u.uid}`), {
        roleName: name,
        avatar,
        updatedAt: Date.now(),
      });
      onClose?.();
    } catch (e) {
      console.error(e);
      alert("儲存失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div style={wrap}>
      <div style={backdrop} onClick={onClose} />
      <div style={panel} role="dialog" aria-modal="true" aria-label="編輯角色">
        <h3 style={{ marginTop: 0 }}>編輯角色</h3>

        {!initDone ? (
          <div style={{ padding: 12 }}>載入中…</div>
        ) : (
          <>
            <div style={{ marginTop: 8 }}>
              <div style={label}>角色名稱（公開，1–20 字）</div>
              <input
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                maxLength={20}
                style={input}
                placeholder="例如：小可愛、社畜阿華"
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={label}>頭像</div>
              <div style={{ display: "flex", gap: 10 }}>
                {AVATARS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setAvatar(k)}
                    aria-label={k}
                    style={{
                      ...avatarBtn,
                      borderColor: avatar === k ? "#1d4ed8" : "#ddd",
                      color: avatar === k ? "#1d4ed8" : "#333",
                    }}
                  >
                    <span style={{ fontSize: 28 }}>{AVATAR_EMOJI[k]}</span>
                    <div style={{ fontSize: 12, marginTop: 2 }}>{k}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button onClick={onClose} style={btn}>取消</button>
              <button onClick={onSave} disabled={!canSave || loading} style={{ ...btnPrimary, marginLeft: 8 }}>
                {loading ? "儲存中…" : "儲存"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* --- styles --- */
const wrap = { position: "fixed", inset: 0, zIndex: 120, display: "grid", placeItems: "center" };
const backdrop = { position: "absolute", inset: 0, background: "rgba(0,0,0,.4)" };
const panel = {
  position: "relative",
  zIndex: 1,
  width: 420,
  maxWidth: "92vw",
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 14,
  boxShadow: "0 16px 30px rgba(0,0,0,.2)",
  padding: 16,
};
const label = { fontSize: 12, color: "#666", marginBottom: 6 };
const input = { width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, outline: "none" };
const btn = { padding: "10px 16px", border: "2px solid #333", background: "#fff", borderRadius: 12, fontWeight: 800, cursor: "pointer" };
const btnPrimary = { ...btn, borderColor: "#1d4ed8", color: "#1d4ed8" };
const avatarBtn = {
  ...btn,
  width: 74,
  display: "grid",
  placeItems: "center",
  borderRadius: 12,
};
