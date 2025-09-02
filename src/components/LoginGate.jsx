// src/components/LoginGate.jsx
import React, { useMemo, useState } from "react";
import { auth, db } from "../firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { ref, set, update, push, serverTimestamp, get } from "firebase/database";

console.log("✅ LoginGate loaded (NEW)"); // 用來辨認是否載到新元件

const AVATARS = [
  { id: "bunny", emoji: "🐰", label: "小兔" },
  { id: "bear",  emoji: "🐻", label: "小熊" },
  { id: "cat",   emoji: "🐱", label: "小貓" },
  { id: "duck",  emoji: "🦆", label: "小鴨" },
];

// 允許英文大小寫 + 數字
const normUsername = (s) => (s || "").replace(/[^a-zA-Z0-9]/g, "");

export default function LoginGate({ open = true, onDone }) {
  const [username, setUsername] = useState("");
  const [realName, setRealName] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("bunny");
  const [loading, setLoading] = useState(false);

  const u = useMemo(() => normUsername(username), [username]);
  const email = useMemo(() => (u ? `${u}@groupbuy.local` : ""), [u]);

  if (!open) return null;

  const validate = () => {
    if (!realName.trim()) return alert("請輸入真實姓名"), false;
    if (!u) return alert("請輸入帳號（英文或數字，可大寫小寫）"), false;
    if ((password || "").length < 6) return alert("請輸入密碼（至少 6 碼）"), false;
    return true;
  };

  const enterTown = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // 先嘗試登入
      await signInWithEmailAndPassword(auth, email, password);

      // 登入成功 → 補寫必要欄位
      const uid = auth.currentUser?.uid;
      if (uid) {
        const pubSnap = await get(ref(db, `playersPublic/${uid}`));
        const pub = pubSnap.val() || {};
        const pubPatch = {};
        if (!pub.avatar) pubPatch.avatar = avatar || "bunny";
        if (!pub.roleName) pubPatch.roleName = realName.trim();
        if (Object.keys(pubPatch).length) {
          await update(ref(db, `playersPublic/${uid}`), {
            ...pubPatch,
            online: true,
            updatedAt: serverTimestamp(),
          });
        }
        const priSnap = await get(ref(db, `playersPrivate/${uid}`));
        const pri = priSnap.val() || {};
        if (!pri.realName) {
          await update(ref(db, `playersPrivate/${uid}`), {
            realName: realName.trim(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      onDone?.();
    } catch (err) {
      // 帳號不存在 → 自動註冊
      if (err?.code === "auth/user-not-found") {
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          const uid = cred.user.uid;

          await set(ref(db, `playersPublic/${uid}`), {
            uid,
            roleName: realName.trim(),
            avatar: avatar || "bunny",
            x: 400, y: 300, dir: "down",
            bubble: null,
            coins: 0,
            online: true,
            updatedAt: serverTimestamp(),
          });

          await set(ref(db, `playersPrivate/${uid}`), {
            uid,
            realName: realName.trim(),
            username: u,
            updatedAt: serverTimestamp(),
          });

          await push(ref(db, `playersPrivate/${uid}/nameHistory`), {
            from: null,
            to: realName.trim(),
            ts: serverTimestamp(),
            by: uid,
          });

          onDone?.();
        } catch (e2) {
          console.error(e2);
          alert(e2?.message || "註冊失敗");
        }
      } else {
        console.error(err);
        alert(err?.message || "登入失敗");
      }
    } finally {
      setLoading(false);
    }
  };

  // UI（左右兩欄 + 下方一顆按鈕）
  return (
    <div role="dialog" aria-modal="true" style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.28)",
      display: "grid", placeItems: "center", zIndex: 200, padding: 12,
    }}>
      <div style={{ width: "min(960px, 96vw)" }}>
        <h2 style={{ textAlign: "center", marginTop: 0, marginBottom: 12, fontWeight: 800 }}>
          建立你的角色（LoginGate）
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* 左：真實姓名 / 帳號 / 密碼 */}
          <div className="card" style={{ background: "#fff", padding: 16, borderRadius: 16 }}>
            <label>真實姓名</label>
            <input
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder="王小明"
              style={{ width: "100%", marginBottom: 8 }}
            />

            <label>帳號（英文或數字，可大寫小寫）</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Peishao2025"
              style={{ width: "100%", marginBottom: 4 }}
            />
            <div style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>
              將使用：<strong>{u || "your_id"}</strong>@groupbuy.local
            </div>

            <label>密碼（至少 6 碼）</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              style={{ width: "100%" }}
            />
          </div>

          {/* 右：頭像選擇 */}
          <div className="card" style={{ background: "#fff", padding: 16, borderRadius: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>選擇頭像</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAvatar(a.id)}
                  style={{
                    padding: 12, borderRadius: 14,
                    border: avatar === a.id ? "2px solid #ec4899" : "1px solid #e5e7eb",
                    background: "#fff",
                  }}
                  title={a.label}
                >
                  <div style={{ fontSize: 28 }}>{a.emoji}</div>
                  <div style={{ fontSize: 12 }}>{a.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 下：進入小鎮 */}
        <div style={{ display: "grid", placeItems: "center", marginTop: 16 }}>
          <button
            onClick={enterTown}
            disabled={loading}
            style={{
              width: "min(420px, 92%)",
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontWeight: 700,
            }}
          >
            {loading ? "處理中…" : "進入小鎮"}
          </button>
        </div>
      </div>
    </div>
  );
}
