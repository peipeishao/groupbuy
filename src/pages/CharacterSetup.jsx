// src/pages/CharacterSetup.jsx
import React, { useState } from "react";
import { usePlayer } from "../store/playerContext.jsx";

const AVATARS = [
  { id: "bunny", emoji: "🐰", label: "小兔" },
  { id: "bear",  emoji: "🐻", label: "小熊" },
  { id: "cat",   emoji: "🐱", label: "小貓" },
  { id: "duck",  emoji: "🦆", label: "小鴨" },
];

export default function CharacterSetup({ onDone }) {
  const { profile, setIdentity } = usePlayer();
  const [name, setName] = useState(profile.name || "");
  const [realName, setRealName] = useState(profile.realName || "");
  const [avatar, setAvatar] = useState(profile.avatar || "bunny");

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !realName.trim()) return alert("請填暱稱與真實姓名");
    await setIdentity({ name: name.trim(), realName: realName.trim(), avatar });
    onDone?.();
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#FFFDF8" }}>
      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 16, padding: 20, width: 360 }}>
        <h2 style={{ marginTop: 0 }}>建立你的角色</h2>
        <label>暱稱（頭上會顯示）</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="旅人" style={{ width: "100%", margin: "6px 0 12px 0" }}/>
        <label>真實姓名</label>
        <input value={realName} onChange={e=>setRealName(e.target.value)} placeholder="王小明" style={{ width: "100%", margin: "6px 0 12px 0" }}/>
        <label>選擇頭像</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, margin: "6px 0 12px 0" }}>
          {AVATARS.map(a => (
            <button type="button" key={a.id}
              onClick={()=>setAvatar(a.id)}
              style={{
                padding: 10, borderRadius: 12, border: avatar===a.id ? "2px solid #f6a" : "1px solid #ddd",
                background: "#fff", cursor: "pointer"
              }}>
              <div style={{ fontSize: 28 }}>{a.emoji}</div>
              <div style={{ fontSize: 12, color: "#555" }}>{a.label}</div>
            </button>
          ))}
        </div>
        <button type="submit" style={{ width: "100%", padding: 10, borderRadius: 10 }}>進入小鎮</button>
      </form>
    </div>
  );
}
