// src/components/ProfileEditor.jsx
import React, { useEffect, useState } from "react";
import { usePlayer } from "../store/playerContext.jsx";

const PRESETS = [
  { id: "bunny"},
  { id: "bear"},
  { id: "cat"},
  { id: "duck" },
];

export default function ProfileEditor({ open, onClose, extraAvatarControl = null }) {
  const { profile, roleName, avatar, updateRole } = usePlayer();
  const [nameInput, setNameInput] = useState(roleName || "旅人");
  const [choice, setChoice] = useState(avatar || "bunny");

  useEffect(() => {
    if (!open) return;
    setNameInput(roleName || "旅人");
    setChoice(avatar || "bunny");
  }, [open, roleName, avatar]);

  if (!open) return null;

  // 儲存：只更新暱稱，頭像僅在選了「預設」時才更新（避免覆蓋現有 custom）
  async function onSave() {
    const patch = { roleName: nameInput?.trim().slice(0, 20) || "旅人" };
    if (choice !== "custom") patch.avatar = choice;
    await updateRole(patch);
    onClose?.();
  }

  const avNode = (p) => (
    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #eee", borderRadius: 10, padding: "6px 8px" }}>
      <input
        type="radio"
        name="av"
        value={p.id}
        checked={choice === p.id}
        onChange={() => setChoice(p.id)}
      />
      <span style={{ fontSize: 20 }}>
        {{ bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" }[p.id]}
      </span>
      <span>{p.label}</span>
    </label>
  );

  const isCustom = profile?.avatar === "custom" && profile?.avatarUrl;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1500, display: "grid", placeItems: "center", padding: 12 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(560px,96vw)", background: "#fff", borderRadius: 16, border: "1px solid #eee", boxShadow: "0 20px 48px rgba(0,0,0,.25)", overflow: "hidden" }}
      >
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #eee", background: "#f9fafb", fontWeight: 900 }}>
          編輯角色
        </div>

        <div style={{ padding: 14, display: "grid", gap: 12 }}>
          {/* 暱稱 */}
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 800 }}>暱稱</div>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={20}
              placeholder="旅人"
              style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: 10 }}
            />
          </label>

          {/* 頭像（預設 + 自訂） */}
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 800 }}>頭像</div>

            {/* 自訂（若目前是 custom 就顯示預覽與 radio） */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #eee", borderRadius: 10, padding: "6px 8px" }}>
              <input
                type="radio"
                name="av"
                value="custom"
                checked={choice === "custom"}
                onChange={() => setChoice("custom")}
              />
              {isCustom ? (
                <img
                  src={profile.avatarUrl}
                  alt="avatar"
                  style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", border: "1px solid #e5e7eb" }}
                />
              ) : (
                <span style={{ fontSize: 20 }}>🖼️</span>
              )}
              <span>自訂</span>
            </label>

            {/* 預設四種 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px,1fr))", gap: 8 }}>
              {PRESETS.map(avNode)}
            </div>

            {/* ✅ 頭像欄位最後：上傳頭像按鈕（由 HUD 傳入） */}
            <div>{extraAvatarControl}</div>
          </div>
        </div>

        <div style={{ padding: "10px 14px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 12px", border: "1px solid #ddd", background: "#fff", borderRadius: 10 }}
          >
            取消
          </button>
          <button
            onClick={onSave}
            style={{ padding: "8px 12px", border: "2px solid #111", background: "#fff", borderRadius: 10, fontWeight: 900 }}
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
