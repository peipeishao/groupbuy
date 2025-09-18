// src/components/LoginModal.jsx — 改為 Email + 密碼；保留真實姓名與頭像；不存在就自動註冊
console.log("NEW LoginModal v3 (email-based) loaded");
import React, { useMemo, useState } from "react";
import { auth, db } from "../firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { ref, set, update, push, serverTimestamp, get } from "firebase/database";

const AVATARS = [
  { id: "bunny", emoji: "🐰", label: "小兔" },
  { id: "bear",  emoji: "🐻", label: "小熊" },
  { id: "cat",   emoji: "🐱", label: "小貓" },
  { id: "duck",  emoji: "🦆", label: "小鴨" },
];

const isEmail = (s) => /\S+@\S+\.\S+/.test(String(s || "").trim());

export default function LoginModal({ open = true, onDone }) {
  const [email, setEmail] = useState("");
  const [realName, setRealName] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("bunny");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const validate = () => {
    if (!isEmail(email)) {
      alert("請輸入有效 Email");
      return false;
    }
    if (!realName.trim()) {
      alert("請輸入真實姓名");
      return false;
    }
    if ((password || "").length < 6) {
      alert("請輸入密碼（至少 6 碼）");
      return false;
    }
    return true;
  };

  const enterTown = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // 先嘗試登入
      await signInWithEmailAndPassword(auth, email.trim(), password);

      // 登入成功 → 補寫資料
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
      if (err?.code === "auth/user-not-found") {
        // 若不存在 → 建立帳號
        try {
          const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
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
            username: (email.split("@")[0] || "player").replace(/[^a-z0-9]/gi, "").slice(0, 20),
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.28)",
        display: "grid",
        placeItems: "center",
        zIndex: 200,
        padding: 12,
      }}
    >
      <div style={{ width: "min(960px, 96vw)" }}>
        <h2
          style={{
            textAlign: "center",
            marginTop: 0,
            marginBottom: 12,
            fontWeight: 800,
          }}
        >
          建立你的角色
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          {/* 左側輸入欄位 */}
          <div className="card" style={{ background: "#fff", padding: 16, borderRadius: 16 }}>
            <label>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yourname@gmail.com"
              style={{ width: "100%", marginBottom: 8 }}
              autoComplete="username"
            />

            <label>真實姓名</label>
            <input
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder="王小明"
              style={{ width: "100%", marginBottom: 8 }}
            />

            <label>密碼（至少 6 碼）</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              style={{ width: "100%" }}
              autoComplete="new-password"
            />
          </div>

          {/* 右側頭像選擇 */}
          <div className="card" style={{ background: "#fff", padding: 16, borderRadius: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>選擇頭像</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 10,
              }}
            >
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAvatar(a.id)}
                  style={{
                    padding: 12,
                    borderRadius: 14,
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

        {/* 下方按鈕 */}
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
