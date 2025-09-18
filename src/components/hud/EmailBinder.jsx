// src/components/hud/EmailBinder.jsx
import React, { useEffect, useMemo, useState } from "react";
import { auth } from "../../firebase.js";
import {
  verifyBeforeUpdateEmail,
  sendEmailVerification,
  reauthenticateWithCredential,
  EmailAuthProvider,
  linkWithCredential,
} from "firebase/auth";

export default function EmailBinder() {
  const user = auth.currentUser;
  const [curEmail, setCurEmail] = useState(user?.email || "");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setCurEmail(auth.currentUser?.email || "");
  }, [auth.currentUser?.email]);

  const hasPasswordProvider = useMemo(() => {
    const u = auth.currentUser;
    if (!u) return false;
    return (u.providerData || []).some((p) => p?.providerId === "password");
  }, [auth.currentUser?.uid]);

  const isVerified = !!auth.currentUser?.emailVerified;

  async function refreshUser() {
    try { await auth.currentUser?.reload(); setCurEmail(auth.currentUser?.email || ""); } catch {}
  }

  async function handleUpdate() {
    setMsg(""); setErr("");
    const u = auth.currentUser;
    const email = String(newEmail || "").trim().toLowerCase();

    if (!u)           { setErr("尚未登入"); return; }
    if (!email || !email.includes("@")) { setErr("請輸入有效的 Email"); return; }
    if (!password)    { setErr(hasPasswordProvider ? "請輸入目前密碼" : "請為此 Email 設定一組密碼"); return; }

    setBusy(true);
    try {
      if (hasPasswordProvider) {
        // 1) 既有密碼登入 → reauth + verifyBeforeUpdateEmail
        const cred = EmailAuthProvider.credential(u.email || email, password);
        await reauthenticateWithCredential(u, cred);
        await verifyBeforeUpdateEmail(u, email); // 會寄驗證信到「新 Email」
        setMsg(`已寄出驗證信到 ${email}，請至信箱點擊連結完成 Email 更改。`);
        setNewEmail(""); setPassword("");
      } else {
        // 2) 沒有密碼提供者 → 用新 Email+密碼 建立密碼登入並綁定，再寄驗證信
        const cred = EmailAuthProvider.credential(email, password);
        await linkWithCredential(u, cred);       // 需要在主控台啟用 Email/Password
        await sendEmailVerification(auth.currentUser);
        await refreshUser();
        setMsg(`已綁定 ${email} 並寄出驗證信，請到信箱完成驗證。`);
        setNewEmail(""); setPassword("");
      }
    } catch (e) {
      console.error("[EmailBinder] update/link failed:", e);
      const code = e?.code || "";
      if (code === "auth/operation-not-allowed") {
        setErr("此專案尚未啟用 Email/Password 登入。請到 Firebase Console 啟用後再試。");
      } else if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setErr("密碼不正確，請再試一次。");
      } else if (code === "auth/email-already-in-use") {
        setErr("此 Email 已被使用，請換一個 Email。");
      } else if (code === "auth/requires-recent-login") {
        setErr("為了安全性，需要近期登入。請先登出再登入一次，或在此視窗重登後再試。");
      } else {
        setErr(e?.message || "更新失敗，請稍後再試。");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSendVerify() {
    setMsg(""); setErr("");
    const u = auth.currentUser;
    if (!u) { setErr("尚未登入"); return; }
    if (!u.email) { setErr("目前帳號尚未綁定 Email，請先設定 Email 後再寄送驗證信。"); return; }
    setBusy(true);
    try {
      await sendEmailVerification(u);
      setMsg(`驗證郵件已寄出至：${u.email}`);
    } catch (e) {
      console.error("[EmailBinder] send verify failed:", e);
      setErr(e?.message || "驗證郵件寄送失敗，請稍後再試。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 6, fontWeight: 800 }}>
        綁定 / 修改 Email（忘記密碼需要收信）
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#334155" }}>
          目前 Email：<b>{curEmail || "（尚未綁定）"}</b>{" "}
          {curEmail ? (
            isVerified ? <span style={{ color: "#16a34a" }}>（已驗證）</span> : <span style={{ color: "#b45309" }}>（未驗證）</span>
          ) : null}
        </div>

        <label style={label}>新 Email</label>
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="例如：yourname@gmail.com"
          disabled={busy}
          style={input}
        />

        <label style={label}>{hasPasswordProvider ? "目前密碼" : "設定密碼（用於日後登入）"}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={hasPasswordProvider ? "請輸入目前密碼" : "請設定一組密碼"}
          disabled={busy}
          style={input}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <button onClick={handleUpdate} disabled={busy} style={primaryBtn}>
            {busy ? "處理中…" : (hasPasswordProvider ? "送出更換（寄驗證信）" : "綁定 Email + 密碼")}
          </button>
          <button onClick={handleSendVerify} disabled={busy} style={secondaryBtn}>
            {busy ? "處理中…" : "寄送/重寄 驗證信"}
          </button>
        </div>

        {msg && <div style={{ color: "#065f46", fontSize: 12 }}>{msg}</div>}
        {err && <div style={{ color: "#b91c1c", fontSize: 12 }}>{err}</div>}
      </div>
    </div>
  );
}

const label = { display: "block", fontSize: 12, color: "#475569", marginTop: 6 };
const input = { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8 };
const primaryBtn = { padding: "8px 12px", borderRadius: 8, border: "2px solid #111", background: "#fff", fontWeight: 800, cursor: "pointer" };
const secondaryBtn = { padding: "8px 12px", borderRadius: 8, border: "1px solid #64748b", background: "#fff", fontWeight: 700, cursor: "pointer" };
