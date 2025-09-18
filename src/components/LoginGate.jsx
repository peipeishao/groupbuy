// src/components/LoginGate.jsx — 改為 Email 登入/註冊；修復快速登入；加忘記密碼
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
  sendPasswordResetEmail,
} from "firebase/auth";
import { ref as dbRef, get as dbGet, set as dbSet, push as dbPush, update as dbUpdate, serverTimestamp } from "firebase/database";

// 簡單的 Email 檢查
const isEmail = (s) => /\S+@\S+\.\S+/.test(String(s || "").trim());

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

  // login form（Email）
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  // signup form（Email + RealName）
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPassword2, setSignupPassword2] = useState("");
  const [signupRealName, setSignupRealName] = useState("");

  // 快速登入用的「預帶 Email」
  const [presetEmail, setPresetEmail] = useState("");
  const [autoSubmitToken, setAutoSubmitToken] = useState(0);
  const pwdInputRef = useRef(null);

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

  // 當 auth 狀態轉為非匿名時，將帳號加入快速登入清單（用 Email）
  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u || u.isAnonymous) return;
      let display = "";
      try {
        const snap = await dbGet(dbRef(db, `playersPrivate/${u.uid}/realName`));
        display = String(snap.val() || "");
      } catch {}
      const email = u.email || "";
      if (email) addRememberedAccount({ email, display: display || email.split("@")[0], avatar: "🙂" });
    });
    return () => off();
  }, []);

  // 快速登入：嘗試使用瀏覽器憑證；失敗則帶入 Email 並聚焦密碼欄
  async function handleSelectRemembered(acc) {
    const email = String(acc?.email || "").trim();
    try {
      if ("credentials" in navigator) {
        const cred = await navigator.credentials.get({ password: true, mediation: "optional" });
        if (cred && cred.type === "password" && String(cred.id || "").toLowerCase() === email.toLowerCase()) {
          await signInWithEmailAndPassword(auth, email, cred.password);
          // 公告
          try {
            const u = auth.currentUser;
            let rn = "";
            if (u) {
              const snap = await dbGet(dbRef(db, `playersPrivate/${u.uid}/realName`));
              rn = String(snap.val() || "");
            }
            await announce(`歡迎${rn || (email.split("@")[0])}加入小鎮`);
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
    // 取不到密碼 → 預帶 Email，切到登入頁，聚焦密碼欄
    setMode("login");
    setPresetEmail(email);
    setTimeout(() => setAutoSubmitToken(Date.now()), 0);
  }

  // 把 presetEmail 套到輸入框並聚焦密碼
  useEffect(() => {
    if (!open) return;
    if (!presetEmail) return;
    setLoginEmail(presetEmail);
    setTimeout(() => pwdInputRef.current?.focus(), 0);
  }, [presetEmail, autoSubmitToken, open]);

  // 登入
  async function doLogin(e) {
    e?.preventDefault?.();
    const email = String(loginEmail || "").trim();
    if (!isEmail(email)) { alert("請輸入有效的 Email"); return; }
    if (!loginPassword) { alert("請輸入密碼"); return; }
    try {
      await signInWithEmailAndPassword(auth, email, loginPassword);
      // 公告（抓 playersPrivate 的 realName）
      let nameForAnnounce = email.split("@")[0];
      try {
        const u = auth.currentUser;
        if (u) {
          const snap = await dbGet(dbRef(db, `playersPublic/${u.uid}/roleName`));
          const rn = String(snap.val() || "");
          if (rn) nameForAnnounce = rn;
        }
      } catch {}
      await announce(`歡迎${nameForAnnounce}加入小鎮`);

      // 更新 playersPublic.online
      try {
        const u = auth.currentUser;
        if (u?.uid) {
          await dbUpdate(dbRef(db, `playersPublic/${u.uid}`), { online: true, updatedAt: serverTimestamp() });
        }
      } catch {}

      resumeActionRef.current?.(); resumeActionRef.current = null;
      window.dispatchEvent(new CustomEvent("login-success", { detail: openOptionsRef.current || {} }));
      setOpen(false);
    } catch (e) {
      console.error(e);
      alert(e.message || "登入失敗");
    }
  }

  // 忘記密碼
  async function doForgot() {
    const email = String(loginEmail || presetEmail || "").trim();
    if (!isEmail(email)) { alert("請先輸入有效的 Email"); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`已寄出重設密碼郵件到：${email}`);
    } catch (e) {
      console.error(e);
      alert(e?.message || "寄送失敗，請稍後再試");
    }
  }

  // 註冊
  async function doSignup(e) {
    e?.preventDefault?.();
    const email = String(signupEmail || "").trim().toLowerCase();
    const pwd = String(signupPassword || "");
    const pwd2 = String(signupPassword2 || "");
    const rn = String(signupRealName || "").trim();
    if (!isEmail(email)) { alert("請輸入有效的 Email"); return; }
    if (!rn) { alert("請輸入真實姓名"); return; }
    if (!pwd) { alert("請輸入密碼"); return; }
    if (pwd !== pwd2) { alert("兩次密碼不一致"); return; }

    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, pwd);

      // playersPublic / playersPrivate 初始資料
      await dbSet(dbRef(db, `playersPublic/${user.uid}`), {
        uid: user.uid,
        roleName: rn,
        avatar: "bunny",
        x: 400, y: 300, dir: "down",
        bubble: null,
        coins: 0,
        online: true,
        updatedAt: serverTimestamp(),
      });
      await dbSet(dbRef(db, `playersPrivate/${user.uid}`), {
        uid: user.uid,
        username: email.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 20) || "player",
        realName: rn,
        updatedAt: serverTimestamp(),
      });

      // 用暱稱（剛寫進 roleName 的 rn）
await announce(`歡迎${(rn || email.split("@")[0])}加入小鎮`);

      // 記住帳號
      addRememberedAccount({ email, display: rn || email.split("@")[0], avatar: "🙂" });

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
      <div style={{ position: "relative", zIndex: 1, width: 460, maxWidth: "92vw" }}>
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
            <button onClick={() => setMode("login")}  style={tabBtn(mode === "login")}>Email 登入</button>
            <button onClick={() => setMode("signup")} style={tabBtn(mode === "signup")}>用 Email 建立帳號</button>
          </div>

          <div style={{ padding: 16 }}>
            {mode === "login" ? (
              <div style={hintStyle}>
                使用 <b>Email</b> 與密碼登入。
              </div>
            ) : (
              <div style={hintStyle}>
                以 <b>Email</b> 建立帳號，並填寫真實姓名（用於對帳）。登入使用 Email + 密碼。
              </div>
            )}

            {/* Forms */}
            {mode === "login" ? (
              <form onSubmit={doLogin} style={{ display:"grid", gap:8 }}>
                <input
                  style={input}
                  placeholder="yourname@gmail.com"
                  value={loginEmail}
                  onChange={e=>setLoginEmail(e.target.value)}
                  autoComplete="username"
                />
                <input
                  ref={pwdInputRef}
                  style={input}
                  type="password"
                  placeholder="密碼"
                  value={loginPassword}
                  onChange={e=>setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button type="submit" style={submitBtn}>登入</button>
                  <button type="button" onClick={doForgot} style={{ ...submitBtn, background:"#fff", color:"#111827", border:"2px solid #111827" }}>
                    忘記密碼
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={doSignup} style={{ display:"grid", gap:8 }}>
                <input
                  style={input}
                  placeholder="yourname@gmail.com"
                  value={signupEmail}
                  onChange={e=>setSignupEmail(e.target.value)}
                  autoComplete="username"
                />
                <input
                  style={input}
                  type="password"
                  placeholder="密碼（至少 6 碼）"
                  value={signupPassword}
                  onChange={e=>setSignupPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <input
                  style={input}
                  type="password"
                  placeholder="再次輸入密碼"
                  value={signupPassword2}
                  onChange={e=>setSignupPassword2(e.target.value)}
                  autoComplete="new-password"
                />
                <input
                  style={input}
                  placeholder="真實姓名（店家對帳用）"
                  value={signupRealName}
                  onChange={e=>setSignupRealName(e.target.value)}
                />
                <button type="submit" style={submitBtn}>建立帳號</button>
              </form>
            )}

            {/* 快速登入清單 */}
            <RememberedAccounts
              onSelect={(acc) => {
                setMode("login");
                setPresetEmail(String(acc?.email || "").trim());
                setTimeout(() => setAutoSubmitToken(Date.now()), 0);
                // 同時嘗試使用憑證直接登入（若瀏覽器有記住密碼）
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
