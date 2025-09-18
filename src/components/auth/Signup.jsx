// src/components/auth/Signup.jsx
import React, { useEffect, useRef, useState } from "react";
import { auth, db } from "../../firebase.js";
import {
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { ref, set as rtdbSet, update as rtdbUpdate } from "firebase/database";

export default function Signup({ onClose, goLogin, resumeAction }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const emailRef = useRef(null);
  useEffect(() => { setTimeout(() => emailRef.current?.focus(), 0); }, []);

  const emailLocalPart = (em) => String(em || "").split("@")[0] || "";

  async function onSubmit(e) {
    e?.preventDefault?.();
    setErr("");

    const em = String(email || "").trim().toLowerCase();
    if (!em || !em.includes("@")) { setErr("請輸入有效的 Email"); return; }
    if (!password) { setErr("請設定密碼"); return; }
    if (password !== confirm) { setErr("兩次密碼不一致"); return; }

    setLoading(true);
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const cred = await createUserWithEmailAndPassword(auth, em, password);

      const uname = emailLocalPart(em).replace(/[^a-z0-9]/g, "").slice(0, 20) || "player";

      // playersPrivate：存 uid, username, realName(空), updatedAt
      try {
        await rtdbSet(ref(db, `playersPrivate/${cred.user.uid}`), {
          uid: cred.user.uid,
          username: uname,
          realName: "",
          updatedAt: Date.now(),
        });
      } catch {}

      // playersPublic：預設 roleName 用 username
      try {
        await rtdbUpdate(ref(db, `playersPublic/${cred.user.uid}`), {
          uid: cred.user.uid,
          roleName: uname,
          updatedAt: Date.now(),
        });
      } catch {}

      resumeAction?.();
      onClose?.();
    } catch (e2) {
      console.error("[Signup] failed:", e2);
      setErr(e2?.message || "註冊失敗，請再試一次");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ fontWeight: 800 }}>Email</label>
        <input
          ref={emailRef}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="例如：yourname@gmail.com"
          required
          autoComplete="username"
          style={input}
        />

        <label style={{ fontWeight: 800, marginTop: 8 }}>密碼</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="請設定密碼"
          required
          autoComplete="new-password"
          style={input}
        />

        <label style={{ fontWeight: 800, marginTop: 8 }}>再次輸入密碼</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="請再次輸入密碼"
          required
          autoComplete="new-password"
          style={input}
        />

        <div style={{ fontSize: 12, color: "#666" }}>
          建立後可於「編輯角色」修改顯示名稱與真實姓名；登入使用 Email + 密碼。
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          記住我（下次自動保持登入）
        </label>

        {err && <div style={{ color: "#b91c1c", fontSize: 12 }}>{err}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "2px solid #22c55e",
            background: loading ? "#ecfdf5" : "#fff",
            color: "#16a34a",
            fontWeight: 800,
            cursor: loading ? "default" : "pointer",
            marginTop: 8,
          }}
        >
          {loading ? "建立中…" : "建立帳號"}
        </button>

        <button
          type="button"
          onClick={() => goLogin?.()}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "2px solid #333",
            background: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          我已有帳號，要登入
        </button>
      </div>
    </form>
  );
}

const input = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  width: "100%",
};
