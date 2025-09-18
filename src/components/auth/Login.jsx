// src/components/auth/Login.jsx
import React, { useRef, useState } from "react";
import { auth } from "../../firebase.js";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

const LEGACY_DOMAIN = "@groupbuy.local";
const REM_KEY = "gb.remembered.accounts.email";

function normalizeLoginInput(s) {
  const t = String(s || "").trim();
  // 如果使用者沒輸入 @，視為舊帳號，補上 legacy domain
  if (!t.includes("@")) return (t ? `${t}${LEGACY_DOMAIN}` : "");
  return t.toLowerCase();
}
function loadRemembered() {
  try { const raw = localStorage.getItem(REM_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveRemembered(list) {
  try { localStorage.setItem(REM_KEY, JSON.stringify(list.slice(0, 8))); } catch {}
}

export default function Login({ onClose, goSignup, resumeAction }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [list, setList] = useState(() => loadRemembered());

  const pwdRef = useRef(null);

  const onPickRemembered = async (em) => {
    setEmail(em);
    setErr("");
    setTimeout(() => pwdRef.current?.focus(), 0);
  };

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    setErr("");

    const emailToUse = normalizeLoginInput(email);
    if (!emailToUse) { setErr("請輸入 Email 或帳號"); return; }
    if (!pwd) { setErr("請輸入密碼"); return; }

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, emailToUse, pwd);

      if (remember) {
        const now = Date.now();
        const next = Array.isArray(list) ? [...list] : [];
        const i = next.findIndex((x) => x?.email === emailToUse);
        if (i >= 0) next[i] = { email: emailToUse, lastUsedAt: now };
        else next.unshift({ email: emailToUse, lastUsedAt: now });
        setList(next);
        saveRemembered(next);
      }

      onClose?.();
      resumeAction?.();
    } catch (e2) {
      console.error("[Login] sign-in failed:", e2);
      setErr("登入失敗，請確認帳號/Email 與密碼是否正確");
    } finally {
      setSubmitting(false);
    }
  };

  const onForgot = async () => {
    setErr("");
    const emailToUse = normalizeLoginInput(email);
    if (!emailToUse) { setErr("請先輸入 Email（或舊帳號）"); return; }
    if (emailToUse.endsWith(LEGACY_DOMAIN)) {
      // 舊帳號寄不到信，提示改綁
      setErr("此帳號為舊制（@groupbuy.local），無法寄送重設信。請先到『編輯角色 → 綁定/修改 Email』後再重試。");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, emailToUse);
      alert(`已寄出重設密碼郵件到：${emailToUse}`);
    } catch (e) {
      console.error("[Login] reset failed:", e);
      setErr("無法寄送重設郵件，請確認 Email 是否正確或稍後再試");
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={head}>
          <b>登入</b>
          <button onClick={onClose} style={xBtn}>×</button>
        </div>

        <form onSubmit={onSubmit} autoComplete="off" style={{ padding: 14, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={label}>Email（或舊帳號）</label>
            <input
              name="login-email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="例如：user@gmail.com（舊用戶可輸入原帳號）"
              style={input}
              autoFocus
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={label}>密碼</label>
            <input
              ref={pwdRef}
              name="login-password"
              type="password"
              autoComplete="current-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="請輸入密碼"
              style={input}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            記住我（下次快速帶入帳號/Email）
          </label>

          {err && <div style={{ color: "#b91c1c", fontSize: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <button type="submit" disabled={submitting} style={primaryBtn}>
              {submitting ? "登入中…" : "登入"}
            </button>
            <button type="button" onClick={goSignup} style={secondaryBtn}>建立帳號</button>
            <button type="button" onClick={onForgot} style={linkBtn}>忘記密碼</button>
          </div>
        </form>

        {Array.isArray(list) && list.length > 0 && (
          <div style={{ padding: "6px 14px 14px" }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: "#334155", marginBottom: 6 }}>
              快速選擇被記住的帳號/Email
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {list.map((it) => (
                <button
                  key={it.email}
                  onClick={() => onPickRemembered(it.email)}
                  style={chipBtn}
                  title={it.email}
                >
                  {it.email}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- styles ---- */
const wrap = { position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"grid", placeItems:"center" };
const card = { width:"min(420px, 96vw)", background:"#fff", border:"1px solid #eee", borderRadius:16, overflow:"hidden", boxShadow:"0 24px 48px rgba(0,0,0,.25)" };
const head = { height:48, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 12px", borderBottom:"1px solid #eee", background:"#f9fafb" };
const xBtn = { padding:"6px 10px", borderRadius:10, border:"1px solid #ddd", background:"#fff", cursor:"pointer" };
const label = { fontSize:12, fontWeight:900, color:"#334155" };
const input = { padding:"10px 12px", border:"1px solid #ddd", borderRadius:10, outline:"none" };
const primaryBtn = { padding:"10px 14px", borderRadius:10, border:"2px solid #111", background:"#fff", fontWeight:900, cursor:"pointer" };
const secondaryBtn = { padding:"10px 14px", borderRadius:10, border:"2px solid #9ca3af", background:"#fff", fontWeight:800, cursor:"pointer" };
const linkBtn = { padding:"10px 12px", borderRadius:10, border:"1px solid transparent", background:"transparent", fontWeight:800, cursor:"pointer", color:"#2563eb" };
const chipBtn = { padding:"8px 10px", borderRadius:999, border:"1px solid #ddd", background:"#fff", fontWeight:800, cursor:"pointer" };
