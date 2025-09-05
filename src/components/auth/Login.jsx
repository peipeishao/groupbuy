// src/components/auth/Login.jsx
import React, { useEffect, useRef, useState } from "react";
import { auth } from "../../firebase.js";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";

const LOCAL_DOMAIN = "groupbuy.local";

// 將「帳號或 email」標準化為 email：
// - 若沒有 @ ：視為帳號 → 強制小寫 + 只留 a-z0-9 → 補上 @groupbuy.local
// - 若有 @  ：視為 email → 全部轉成小寫
function toEmailNormalized(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  if (s.includes("@")) return s.toLowerCase();
  const id = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${id}@${LOCAL_DOMAIN}`;
}

function mapFirebaseError(e) {
  const code = String(e?.code || "").replace("auth/", "");
  switch (code) {
    case "invalid-credential":
    case "user-not-found":
    case "wrong-password":
      return "帳號或密碼不正確";
    case "too-many-requests":
      return "嘗試次數過多，請稍後再試";
    case "network-request-failed":
      return "網路連線異常，請檢查網路後再試";
    default:
      return e?.message || "登入失敗，請再試一次";
  }
}

export default function Login({
  presetEmail = "",
  autoSubmitToken = 0,   // 點「記住的帳號」後會變動，觸發自動送出流程
  onClose,
  goSignup,
  resumeAction,
}) {
  const [idOrEmail, setIdOrEmail] = useState(presetEmail || "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const emailRef = useRef(null);
  const passRef = useRef(null);
  const formRef = useRef(null);

  // 預設帶入時 → 聚焦密碼；否則聚焦帳號欄
  useEffect(() => {
    if (presetEmail) {
      setIdOrEmail(presetEmail);
      setTimeout(() => passRef.current?.focus(), 0);
    } else {
      setTimeout(() => emailRef.current?.focus(), 0);
    }
  }, [presetEmail]);

  // 當「記住的帳號」被點擊時，嘗試自動帶入並送出
  useEffect(() => {
    if (!autoSubmitToken) return;
    let stopped = false;

    async function tryAuto() {
      passRef.current?.focus();

      // 優先使用瀏覽器密碼管理器
      try {
        if ("credentials" in navigator) {
          const cred = await navigator.credentials.get({ password: true, mediation: "required" });
          if (cred && cred.type === "password") {
            const emailToUse = toEmailNormalized(cred.id || idOrEmail);
            setIdOrEmail(emailToUse);
            setPassword(cred.password || "");
            setTimeout(() => formRef.current?.requestSubmit(), 0);
            return;
          }
        }
      } catch {/* ignore */}

      // 2 秒內輪詢：若密碼被自動填入 → 自動送出
      const start = Date.now();
      const iv = setInterval(() => {
        if (stopped) { clearInterval(iv); return; }
        const val = passRef.current?.value;
        if (val && val.length > 0) {
          setPassword(val);
          clearInterval(iv);
          formRef.current?.requestSubmit();
        } else if (Date.now() - start > 2000) {
          clearInterval(iv);
        }
      }, 120);
    }

    tryAuto();
    return () => { stopped = true; };
  }, [autoSubmitToken, idOrEmail]);

  // 🟢 這裡把輸入「沒有 @」的情況下自動轉成「小寫英數」
  function onChangeUser(e) {
    const v = e.target.value || "";
    if (v.includes("@")) {
      setIdOrEmail(v.toLowerCase()); // email → 全轉小寫（避免大小寫造成困惑）
    } else {
      // 帳號 → 只保留小寫英數，從源頭降低「格式錯誤」機率
      setIdOrEmail(v.toLowerCase().replace(/[^a-z0-9]/g, ""));
    }
  }

  async function onSubmit(e) {
    e?.preventDefault?.();
    setErr("");

    const raw = String(idOrEmail || "").trim();
    if (!raw) { setErr("請輸入帳號"); return; }

    const emailToUse = toEmailNormalized(raw);

    setLoading(true);
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, emailToUse, password);

      // 讓瀏覽器記住帳密（提高下次一鍵帶入成功率）
      try {
        if ("credentials" in navigator && window.PasswordCredential) {
          const c = new window.PasswordCredential({
            id: emailToUse,
            password,
            name: emailToUse.split("@")[0],
          });
          await navigator.credentials.store(c);
        }
      } catch {}

      resumeAction?.();
      onClose?.();
    } catch (e) {
      setErr(mapFirebaseError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} autoComplete="on">
      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ fontWeight: 800 }}>帳號</label>
        <input
          id="login-email"
          ref={emailRef}
          type="text"
          name="username"
          value={idOrEmail}
          onChange={onChangeUser}
          placeholder={`例如：pizzawater（會自動加上 @${LOCAL_DOMAIN}）`}
          required
          autoComplete="username"
          style={input}
        />

        <label style={{ fontWeight: 800, marginTop: 8 }}>密碼</label>
        <input
          id="login-pass"
          ref={passRef}
          type="password"
          name="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="請輸入密碼"
          required
          autoComplete="current-password"
          style={input}
        />

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
            border: "2px solid #1d4ed8",
            background: loading ? "#eef2ff" : "#fff",
            color: "#1d4ed8",
            fontWeight: 800,
            cursor: loading ? "default" : "pointer",
            marginTop: 8,
          }}
        >
          {loading ? "登入中…" : "登入"}
        </button>

        <button
          type="button"
          onClick={() => goSignup?.()}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "2px solid #333",
            background: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          建立帳號
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
