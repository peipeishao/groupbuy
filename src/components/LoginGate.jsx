// src/components/LoginGate.jsx
import React, {
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  forwardRef,
} from "react";
import { usePlayer } from "../store/playerContext.jsx";
import RememberedAccounts, { addRememberedAccount } from "./RememberedAccounts.jsx";

import { auth, db } from "../firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { ref as dbRef, get as dbGet, set as dbSet, push as dbPush } from "firebase/database";

const LOCAL_DOMAIN = "groupbuy.local";
function toEmail(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  return s.includes("@") ? s : `${s}@${LOCAL_DOMAIN}`;
}

// 公告
async function announce(text) {
  try {
    if (!auth.currentUser) return;
    await dbPush(dbRef(db, "announcements"), { text, ts: Date.now() });
  } catch {}
}

function LoginGateImpl(_, ref) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const resumeActionRef = useRef(null);
  const openOptionsRef = useRef({}); // 保存 open() 傳入的任意參數（用來 dispatch login-success）

  // login form
  const [loginAccount, setLoginAccount] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  // signup form
  const [signupAccount, setSignupAccount] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPassword2, setSignupPassword2] = useState("");
  const [signupRealName, setSignupRealName] = useState(""); // ✅ 新增真實姓名

  const [presetEmail, setPresetEmail] = useState("");
  const [autoSubmitToken, setAutoSubmitToken] = useState(0);

  const { registerLoginGate } = usePlayer() || {};

  useImperativeHandle(ref, () => ({
    open: (opts = {}) => {
      const { to = "login", resumeAction, ...rest } = opts;
      setMode(to);
      resumeActionRef.current = resumeAction || null;
      openOptionsRef.current = rest || {};
      setOpen(true);
    },
    close: () => setOpen(false),
  }));

  useEffect(() => {
    registerLoginGate?.({
      open: (opts = {}) => {
        const { to = "login", resumeAction, ...rest } = opts;
        setOpen(true);
        setMode(to || "login");
        resumeActionRef.current = resumeAction || null;
        openOptionsRef.current = rest || {};
      },
      close: () => setOpen(false),
    });
  }, [registerLoginGate]);

  // 登入成功後，寫入快速登入清單
  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u || u.isAnonymous) return;
      let username = "";
      try {
        const snap = await dbGet(dbRef(db, `playersPrivate/${u.uid}`));
        username = String(snap.val()?.username || "");
      } catch {}
      const email = username ? `${username}@${LOCAL_DOMAIN}` : (u.email || "");
      const display = (snapRealNameCache.current || "") || username || (email.split("@")[0] || "使用者");
      if (email) addRememberedAccount({ email, display, avatar: "🙂" });
    });
    return () => off();
  }, []);

  const snapRealNameCache = useRef(""); // 暫存剛註冊的 realName 供公告與記住帳號使用

  // 被記住的帳號 → 試圖用瀏覽器憑證自動登入，失敗則帶入 email 並提示送出
  async function handleSelectRemembered(acc) {
    const email = toEmail(acc.email);
    try {
      if ("credentials" in navigator) {
        const cred = await navigator.credentials.get({ password: true, mediation: "required" });
        if (cred && cred.type === "password") {
          const id = toEmail(cred.id || email);
          await signInWithEmailAndPassword(auth, id, cred.password);
          // 公告（抓 playersPrivate 的 realName）
          try {
            const u = auth.currentUser;
            let rn = "";
            if (u) {
              const snap = await dbGet(dbRef(db, `playersPrivate/${u.uid}/realName`));
              rn = String(snap.val() || "");
            }
            await announce(`歡迎${rn || (id.split("@")[0])}加入小鎮`);
          } catch {}
          // resume
          resumeActionRef.current?.(); resumeActionRef.current = null;
          window.dispatchEvent(new CustomEvent("login-success", { detail: openOptionsRef.current || {} }));
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

  // 登入
  async function doLogin(e) {
    e?.preventDefault?.();
    const email = toEmail(loginAccount);
    if (!email || !loginPassword) { alert("請輸入帳號與密碼"); return; }
    try {
      await signInWithEmailAndPassword(auth, email, loginPassword);
      // 公告（抓 playersPrivate 的 realName）
      let nameForAnnounce = email.split("@")[0];
      try {
        const u = auth.currentUser;
        if (u) {
          const snap = await dbGet(dbRef(db, `playersPrivate/${u.uid}/realName`));
          const rn = String(snap.val() || "");
          if (rn) nameForAnnounce = rn;
        }
      } catch {}
      await announce(`歡迎${nameForAnnounce}加入小鎮`);
      resumeActionRef.current?.(); resumeActionRef.current = null;
      window.dispatchEvent(new CustomEvent("login-success", { detail: openOptionsRef.current || {} }));
      setOpen(false);
    } catch (e) {
      console.error(e);
      alert(e.message || "登入失敗");
    }
  }

  // 註冊
  async function doSignup(e) {
    e?.preventDefault?.();
    const account = String(signupAccount || "").trim();
    if (!account || !signupPassword || !signupPassword2 || !signupRealName) {
      alert("請完整填寫帳號 / 密碼 / 再次密碼 / 真實姓名");
      return;
    }
    if (!/^[a-z0-9]{3,20}$/.test(account)) {
      alert("帳號需為英文小寫與數字（3–20）");
      return;
    }
    if (signupPassword !== signupPassword2) {
      alert("兩次密碼不一致");
      return;
    }
    try {
      const email = toEmail(account);
      const { user } = await createUserWithEmailAndPassword(auth, email, signupPassword);
      // playersPrivate 寫入 username + realName
      await dbSet(dbRef(db, `playersPrivate/${user.uid}`), {
        uid: user.uid,
        username: account,
        realName: signupRealName,
        updatedAt: Date.now(),
      });
      snapRealNameCache.current = signupRealName;
      await announce(`歡迎${signupRealName}加入小鎮`);
      alert("建立成功，已自動登入");
      resumeActionRef.current?.(); resumeActionRef.current = null;
      window.dispatchEvent(new CustomEvent("login-success", { detail: openOptionsRef.current || {} }));
      setOpen(false);
    } catch (e) {
      console.error(e);
      alert(e.message || "註冊失敗");
    }
  }

  if (!open) return null;

  const wrap = { position: "fixed", inset: 0, display: "grid", placeItems: "center", zIndex: 100 };
  const tabBtn = (active) => ({
    padding: "12px 0",
    fontWeight: 800,
    border: "none",
    borderBottom: active ? "3px solid #1d4ed8" : "3px solid transparent",
    background: "transparent",
    cursor: active ? "default" : "pointer",
  });
  const hintStyle = {
    marginBottom: 8, fontSize: 12, color: "#555",
    background: "#fbfbfb", border: "1px solid #f0f0f0", borderRadius: 10, padding: "8px 10px",
  };
  const input = { width:"100%", padding:"10px 12px", border:"1px solid #e5e7eb", borderRadius:10, outline:"none" };
  const submitBtn = { padding:"10px 12px", borderRadius:10, background:"#111827", color:"#fff", border:0, cursor:"pointer", fontWeight:800 };

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
              <form onSubmit={doLogin} style={{ display:"grid", gap:8 }}>
                <input style={input} placeholder="帳號（英文小寫）" value={loginAccount} onChange={e=>setLoginAccount(e.target.value.trim())} />
                <input style={input} type="password" placeholder="密碼" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} />
                <button type="submit" style={submitBtn}>登入</button>
              </form>
            ) : (
              <form onSubmit={doSignup} style={{ display:"grid", gap:8 }}>
                <input style={input} placeholder="帳號（英文小寫 3–20）" value={signupAccount} onChange={e=>setSignupAccount(e.target.value.trim())} />
                <input style={input} type="password" placeholder="密碼" value={signupPassword} onChange={e=>setSignupPassword(e.target.value)} />
                <input style={input} type="password" placeholder="再次輸入密碼" value={signupPassword2} onChange={e=>setSignupPassword2(e.target.value)} />
                <input style={input} placeholder="真實姓名" value={signupRealName} onChange={e=>setSignupRealName(e.target.value)} /> {/* ✅ 新欄位 */}
                <button type="submit" style={submitBtn}>建立帳號</button>
              </form>
            )}

            {/* 快速登入清單 */}
            <RememberedAccounts
              onSelect={(acc) => {
                const email = toEmail(acc.email);
                setMode("login");
                setPresetEmail(email);
                setTimeout(() => setAutoSubmitToken(Date.now()), 0);
                // 若支援密碼憑證，handleSelectRemembered 會直接處理
                handleSelectRemembered(acc);
              }}
            />

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
