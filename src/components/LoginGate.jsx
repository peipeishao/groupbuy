// src/components/LoginGate.jsx
import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  linkWithCredential, EmailAuthProvider
} from "firebase/auth";
import { ref, set, update, push, serverTimestamp, get } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";

const AVATARS = [
  { id: "bunny", emoji: "🐰", label: "小兔" },
  { id: "bear",  emoji: "🐻", label: "小熊" },
  { id: "cat",   emoji: "🐱", label: "小貓" },
  { id: "duck",  emoji: "🦆", label: "小鴨" },
];

const normUsername = (s) => (s || "").replace(/[^a-zA-Z0-9]/g, "");

export default function LoginGate() {
  const player = usePlayer();                            // 要在 <PlayerProvider> 之內
  const [visible, setVisible] = useState(false);         // ✅ 預設隱藏
  const [opts, setOpts] = useState({ mode: "upgrade", next: null });

  // 表單狀態
  const [username, setUsername] = useState("");
  const [realName, setRealName] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("bunny");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  const u = useMemo(() => normUsername(username), [username]);
  const email = useMemo(() => (u ? `${u}@groupbuy.local` : ""), [u]);

  // 讓外部（HUD/結帳）可開關這個視窗
  useEffect(() => {
    player.registerLoginGate({
      open: (o = {}) => { setOpts({ mode: "upgrade", next: null, ...o }); setVisible(true); },
      close: () => setVisible(false),
    });
  }, [player]);

  // Esc 關閉
  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) setVisible(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, loading]);

  if (!visible) return null;

  const closeModal = () => { if (!loading) setVisible(false); };

  const validate = () => {
    if (!realName.trim()) return alert("請輸入真實姓名"), false;
    if (!u) return alert("請輸入帳號（英文或數字，可大寫小寫）"), false;
    if ((password || "").length < 6) return alert("請輸入密碼（至少 6 碼）"), false;
    return true;
  };

  const ensureProfiles = async (uid) => {
    const pubRef = ref(db, `playersPublic/${uid}`);
    const priRef = ref(db, `playersPrivate/${uid}`);
    const [pubSnap, priSnap] = await Promise.all([get(pubRef), get(priRef)]);

    if (!pubSnap.exists()) {
      await set(pubRef, {
        uid, roleName: realName.trim(), avatar: avatar || "bunny",
        x: 400, y: 300, dir: "down",
        bubble: null, coins: 100, online: true, updatedAt: serverTimestamp(),
      });
    } else {
      const patch = {};
      const pub = pubSnap.val() || {};
      if (!pub.roleName) patch.roleName = realName.trim();
      if (!pub.avatar)   patch.avatar   = avatar || "bunny";
      await update(pubRef, { ...patch, online: true, updatedAt: serverTimestamp() });
    }

    if (!priSnap.exists()) {
      await set(priRef, { uid, realName: realName.trim(), username: u, updatedAt: serverTimestamp() });
      await push(ref(db, `playersPrivate/${uid}/nameHistory`), { from: null, to: realName.trim(), ts: serverTimestamp(), by: uid });
    } else {
      const pri = priSnap.val() || {};
      const patch = {};
      if (!pri.realName) patch.realName = realName.trim();
      if (!pri.username) patch.username = u;
      if (Object.keys(patch).length) await update(priRef, { ...patch, updatedAt: serverTimestamp() });
    }
  };

  const enterTown = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const cred = EmailAuthProvider.credential(email, password);

      if (auth.currentUser?.isAnonymous && opts.mode === "upgrade") {
        // 匿名升級：保留同一 UID
        const usercred = await linkWithCredential(auth.currentUser, cred);
        await ensureProfiles(usercred.user.uid);
      } else {
        try {
          const usercred = await signInWithEmailAndPassword(auth, email, password);
          await ensureProfiles(usercred.user.uid);
        } catch (err) {
          if (err?.code === "auth/user-not-found") {
            const usercred = await createUserWithEmailAndPassword(auth, email, password);
            await ensureProfiles(usercred.user.uid);
          } else {
            throw err;
          }
        }
      }
      setVisible(false);
    } catch (e) {
      console.error(e);
      alert(e?.message || "登入/註冊失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    // 背景：點擊空白處關閉（loading 中禁用）
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => !loading && closeModal()}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.28)",
        display: "grid", placeItems: "center", zIndex: 200, padding: 12,
      }}
    >
      {/* 內容：阻擋冒泡，避免點到就關 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(960px, 96vw)", position: "relative" }}
      >
        {/* 關閉按鈕（右上角） */}
        <button
          onClick={closeModal}
          disabled={loading}
          aria-label="關閉登入視窗"
          title="關閉"
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 40,
            height: 40,
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background: "#fff",
            fontWeight: 900,
            boxShadow: "0 4px 12px rgba(0,0,0,.15)",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          ×
        </button>

        <h2 style={{ textAlign: "center", marginTop: 0, marginBottom: 12, fontWeight: 800 }}>
          {auth.currentUser?.isAnonymous ? "登入 / 建立帳號（升級）" : "登入你的帳號"}
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
              style={{ width: "100%", marginBottom: 8 }}
            />

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              記住我（此裝置自動登入）
            </label>
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

        {/* 下：確認 */}
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
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "處理中…" : "確定"}
          </button>
        </div>
      </div>
    </div>
  );
}
