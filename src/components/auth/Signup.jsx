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
import { addRememberedAccount } from "../RememberedAccounts.jsx";

const LOCAL_DOMAIN = "groupbuy.local";

// 將輸入強制轉為小寫英數，長度限制 3–20
function normalizeUsername(input) {
  const lower = String(input || "").toLowerCase();
  const alnum = lower.replace(/[^a-z0-9]/g, "");
  return alnum.slice(0, 20);
}

export default function Signup({ onClose, goLogin, resumeAction }) {
  const [username, setUsername] = useState(""); // 小寫英數
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const userRef = useRef(null);
  useEffect(() => { setTimeout(() => userRef.current?.focus(), 0); }, []);

  async function onSubmit(e) {
    e?.preventDefault?.();
    setErr("");

    const u = normalizeUsername(username);
    if (!u || u.length < 3) {
      setErr("帳號需為英文小寫與數字，長度 3–20。");
      return;
    }
    if (!password) { setErr("請設定密碼"); return; }
    if (password !== confirm) { setErr("兩次密碼不一致"); return; }

    const emailToUse = `${u}@${LOCAL_DOMAIN}`;

    setLoading(true);
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const cred = await createUserWithEmailAndPassword(auth, emailToUse, password);

      // playersPrivate：寫入小寫 username
      try {
        await rtdbSet(ref(db, `playersPrivate/${cred.user.uid}`), {
          uid: cred.user.uid,
          realName: "",
          username: u,              // 小寫英數
          updatedAt: Date.now(),
        });
      } catch {}

      // playersPublic：補上 roleName（預設用同一個 username）
      try {
        await rtdbUpdate(ref(db, `playersPublic/${cred.user.uid}`), {
          roleName: u,
          updatedAt: Date.now(),
        });
      } catch {}

      // 快速登入清單（顯示用）
      addRememberedAccount({
        email: emailToUse,
        display: u,
        avatar: "🙂",
      });

      // 儲存瀏覽器 Credential（提升下次一鍵自動填入成功率）
      try {
        if ("credentials" in navigator && window.PasswordCredential) {
          const c = new window.PasswordCredential({
            id: emailToUse,
            password,
            name: u,
          });
          await navigator.credentials.store(c);
        }
      } catch {}

      resumeAction?.();
      onClose?.();
    } catch (e) {
      setErr(e?.message || "註冊失敗，請再試一次");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ fontWeight: 800 }}>帳號（英文小寫）</label>
        <input
          ref={userRef}
          type="text"
          value={username}
          onChange={(e) => setUsername(normalizeUsername(e.target.value))}
          placeholder="例如：pizzawater（系統將建立 pizzawater@groupbuy.local）"
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
          建立後可於「編輯角色」修改顯示名稱；登入仍使用帳號＋密碼。
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
