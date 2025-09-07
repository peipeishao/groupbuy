// src/components/auth/Login.jsx
import React, { useState } from "react";
import { auth } from "../../firebase.js";
import { signInWithEmailAndPassword } from "firebase/auth";

const DOMAIN_SUFFIX = "@groupbuy.local";
const REM_KEY = "gb.remembered.accounts";

function stripDomain(_s) {
  const s = String(_s || "").trim();
  return s.replace(new RegExp(`${DOMAIN_SUFFIX.replace(".", "\\.")}$`, "i"), "");
}
function normalizeUsername(s) { return stripDomain(s).trim(); }

function loadRemembered() {
  try { const raw = localStorage.getItem(REM_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
function saveRemembered(list) {
  try { localStorage.setItem(REM_KEY, JSON.stringify(list)); } catch {}
}

export default function Login({ onClose, goSignup, resumeAction }) {
  const [username, setUsername] = useState("");
  const [pwd, setPwd] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [list, setList] = useState(() => loadRemembered());

  const onPickRemembered = (u) => {
    setUsername(normalizeUsername(u));
    setErr("");
  };

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    setErr("");
    const name = normalizeUsername(username);
    if (!name) { setErr("請輸入帳號"); return; }
    if (!pwd) { setErr("請輸入密碼"); return; }

    const email = `${name}${DOMAIN_SUFFIX}`;
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, pwd);

      if (remember) {
        const now = Date.now();
        const next = Array.isArray(list) ? [...list] : [];
        const i = next.findIndex((x) => x?.username === name);
        if (i >= 0) next[i] = { username: name, lastUsedAt: now };
        else next.unshift({ username: name, lastUsedAt: now });
        const trimmed = next.slice(0, 8);
        setList(trimmed);
        saveRemembered(trimmed);
      }

      onClose?.();
      resumeAction?.();
    } catch (e2) {
      console.error("[Login] sign-in failed:", e2);
      setErr("登入失敗，請確認帳號與密碼是否正確");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={head}>
          <b>登入</b>
          <button onClick={onClose} style={xBtn}>×</button>
        </div>

        {/* ✅ 關閉瀏覽器帳號建議：form + inputs 都設 autocomplete="off" */}
        <form onSubmit={onSubmit} autoComplete="off" style={{ padding: 14, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={label}>帳號</label>
            <input
              name="no-username"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(normalizeUsername(e.target.value))}
              placeholder="請輸入帳號（不含 @groupbuy.local）"
              style={input}
              autoFocus
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={label}>密碼</label>
            <input
              name="gb-password"
              type="password"
              autoComplete="new-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="請輸入密碼"
              style={input}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            記住我（下次快速帶入帳號）
          </label>

          {err && <div style={{ color: "#b91c1c", fontSize: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="submit" disabled={submitting} style={primaryBtn}>
              {submitting ? "登入中…" : "登入"}
            </button>
            <button type="button" onClick={goSignup} style={secondaryBtn}>建立帳號</button>
          </div>
        </form>

        {/* 我們自己的「被記住的帳號」清單（只保留這個） */}
        {Array.isArray(list) && list.length > 0 && (
          <div style={{ padding: "6px 14px 14px" }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: "#334155", marginBottom: 6 }}>
              快速選擇被記住的帳號
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {list.map((it) => (
                <button
                  key={it.username}
                  onClick={() => onPickRemembered(it.username)}
                  style={chipBtn}
                  title={it.username}
                >
                  {it.username}
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
const chipBtn = { padding:"8px 10px", borderRadius:999, border:"1px solid #ddd", background:"#fff", fontWeight:800, cursor:"pointer" };
