// src/components/LoginGate.jsx
import React, {
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  forwardRef,
} from "react";
import Login from "./auth/Login.jsx";
import Signup from "./auth/Signup.jsx";
import { usePlayer } from "../store/playerContext.jsx";

import { auth, db } from "../firebase.js";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { ref as dbRef, get as dbGet } from "firebase/database";

import RememberedAccounts, { addRememberedAccount } from "./RememberedAccounts.jsx";

const LOCAL_DOMAIN = "groupbuy.local";
function toEmail(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  return s.includes("@") ? s : `${s}@${LOCAL_DOMAIN}`;
}

function LoginGateImpl(_, ref) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const resumeActionRef = useRef(null);

  const [presetEmail, setPresetEmail] = useState("");
  const [autoSubmitToken, setAutoSubmitToken] = useState(0);

  const { registerLoginGate } = usePlayer() || {};

  useImperativeHandle(ref, () => ({
    open: ({ to = "login", resumeAction } = {}) => {
      setMode(to);
      resumeActionRef.current = resumeAction || null;
      setOpen(true);
    },
    close: () => setOpen(false),
  }));

  useEffect(() => {
    registerLoginGate?.({
      open: ({ to, resumeAction } = {}) => {
        setOpen(true);
        setMode(to || "login");
        resumeActionRef.current = resumeAction || null;
      },
      close: () => setOpen(false),
    });
  }, [registerLoginGate]);

  // 登入成功後，從 playersPrivate 取得正確大小寫的 username，寫入快速登入清單
  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u || u.isAnonymous) return;
      let username = "";
      try {
        const snap = await dbGet(dbRef(db, `playersPrivate/${u.uid}`));
        username = String(snap.val()?.username || "");
      } catch {}
      const email = username ? `${username}@${LOCAL_DOMAIN}` : (u.email || "");
      const display = username || (email.split("@")[0] || "使用者");
      if (email) addRememberedAccount({ email, display, avatar: "🙂" });
    });
    return () => off();
  }, []);

  // 被記住的帳號 → 優先用瀏覽器憑證直接登入；失敗則帶入 Email 並觸發 Login 的自動送出
  async function handleSelectRemembered(acc) {
    const email = toEmail(acc.email);
    try {
      if ("credentials" in navigator) {
        const cred = await navigator.credentials.get({ password: true, mediation: "required" });
        if (cred && cred.type === "password") {
          const id = toEmail(cred.id || email);
          await signInWithEmailAndPassword(auth, id, cred.password);
          resumeActionRef.current?.(); resumeActionRef.current = null;
          setOpen(false);
          return;
        }
      }
    } catch (e) {
      console.warn("[QuickLogin] credential.get failed:", e);
    }
    setMode("login");
    setPresetEmail(email);
    setTimeout(() => setAutoSubmitToken(Date.now()), 0);
  }

  if (!open) return null;

  return (
    <div style={wrap}>
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.4)" }}
        onClick={() => setOpen(false)}
      />
      <div style={{ position: "relative", zIndex: 1, width: 420, maxWidth: "92vw" }}>
        <div
          style={{
            background: "white",
            borderRadius: 16,
            border: "1px solid #eee",
            boxShadow: "0 18px 36px rgba(0,0,0,.18)",
            overflow: "hidden",
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              background: "#f9fafb",
              borderBottom: "1px solid #eee",
            }}
          >
            <button onClick={() => setMode("login")}  style={tabBtn(mode === "login")}>帳號登入</button>
            <button onClick={() => setMode("signup")} style={tabBtn(mode === "signup")}>建立帳號（英文小寫）</button>
          </div>

          <div style={{ padding: 16 }}>
            {/* 小提示：只改文案，不改邏輯 */}
            {mode === "login" ? (
              <div style={hintStyle}>
                使用 <b>帳號</b> 登入（系統會自動補上 <code>@groupbuy.local</code>）。
              </div>
            ) : (
              <div style={hintStyle}>
                建立新的 <b>帳號（英文小寫與數字，3–20）</b>；登入仍使用帳號＋密碼。
              </div>
            )}

            {/* Forms */}
            {mode === "login" ? (
              <Login
                presetEmail={presetEmail}
                autoSubmitToken={autoSubmitToken}
                onClose={() => setOpen(false)}
                goSignup={() => setMode("signup")}
                resumeAction={() => { resumeActionRef.current?.(); resumeActionRef.current = null; }}
              />
            ) : (
              <Signup
                onClose={() => setOpen(false)}
                goLogin={() => setMode("login")}
                resumeAction={() => { resumeActionRef.current?.(); resumeActionRef.current = null; }}
              />
            )}

            {/* 快速登入清單 */}
            <RememberedAccounts onSelect={handleSelectRemembered} />

            <div style={{ marginTop: 12, textAlign: "right" }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "2px solid #333",
                  background: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const LoginGate = forwardRef(LoginGateImpl);
export default LoginGate;

const wrap = { position: "fixed", inset: 0, display: "grid", placeItems: "center", zIndex: 100 };

function tabBtn(active) {
  return {
    padding: "12px 0",
    fontWeight: 800,
    border: "none",
    borderBottom: active ? "3px solid #1d4ed8" : "3px solid transparent",
    background: "transparent",
    cursor: active ? "default" : "pointer",
  };
}

const hintStyle = {
  marginBottom: 8,
  fontSize: 12,
  color: "#555",
  background: "#fbfbfb",
  border: "1px solid #f0f0f0",
  borderRadius: 10,
  padding: "8px 10px",
};
