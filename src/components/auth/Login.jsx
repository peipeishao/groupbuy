import React, { useState } from "react";
import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "../../firebase.js";
import { ref as dbRef, get, set, remove } from "firebase/database";

// 將「帳號」轉換成 email（若已含 @ 則原樣）
function toEmail(account) {
  if (!account) return "";
  return account.includes("@") ? account : `${account}@groupbuy.local`;
}

// 匿名 → 正式帳號：合併購物袋
async function migrateCart(anonUid, newUid) {
  if (!anonUid || !newUid || anonUid === newUid) return;
  const fromSnap = await get(dbRef(db, `carts/${anonUid}`));
  if (!fromSnap.exists()) return;

  const from = fromSnap.val();
  const toSnap = await get(dbRef(db, `carts/${newUid}`));
  const to = toSnap.exists() ? toSnap.val() : { items: {}, updatedAt: Date.now() };

  const merged = { items: { ...(to.items || {}) }, updatedAt: Date.now() };
  for (const [k, v] of Object.entries(from.items || {})) {
    merged.items[k] = merged.items[k]
      ? { ...merged.items[k], qty: Number(merged.items[k].qty || 0) + Number(v.qty || 0) }
      : v;
  }
  await set(dbRef(db, `carts/${newUid}`), merged);
  await remove(dbRef(db, `carts/${anonUid}`));
}

export default function Login({ onClose, goSignup, resumeAction }) {
  const [account, setAccount] = useState(""); // 只輸入前半（例：peishao）
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    if (!account || !password) return alert("請輸入帳號與密碼");

    const email = toEmail(account);  // ✅ 自動轉 email
    setLoading(true);
    const wasAnon = !!auth.currentUser?.isAnonymous;
    const anonUid = wasAnon ? auth.currentUser.uid : null;

    try {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (wasAnon) await migrateCart(anonUid, cred.user.uid);

      onClose?.();
      resumeAction?.();
    } catch (err) {
      const code = err?.code || "";
      if (code === "auth/wrong-password") alert("密碼錯誤");
      else if (code === "auth/user-not-found") alert("查無此帳號");
      else alert(err.message || code);
    } finally {
      setLoading(false);
    }
  };

  const onReset = async () => {
    if (!account) return alert("先輸入帳號");
    try {
      await sendPasswordResetEmail(auth, toEmail(account));
      alert("已寄出重設密碼信");
    } catch (e) {
      alert(e.message || "發送失敗");
    }
  };

  return (
    <form onSubmit={onSubmit} style={panel}>
      <h3 style={{marginTop:0}}>登入</h3>
      <input
        placeholder="帳號（不需輸入 @groupbuy.local）"
        value={account}
        onChange={(e)=>setAccount(e.target.value)}
        style={input}
      />
      <input
        type="password"
        placeholder="密碼"
        value={password}
        onChange={(e)=>setPassword(e.target.value)}
        style={input}
      />
      <label style={{ fontSize: 12 }}>
        <input type="checkbox" checked={remember} onChange={(e)=>setRemember(e.target.checked)} /> 記住我
      </label>
      <div style={{ display:"flex", gap:8, marginTop:8 }}>
        <button type="submit" disabled={loading} style={btnPrimary}>{loading ? "登入中…" : "登入"}</button>
        <button type="button" onClick={onReset} style={btn}>忘記密碼</button>
        <button type="button" onClick={goSignup} style={btn}>建立帳號</button>
      </div>
      <div style={{fontSize:12, color:"#666", marginTop:8}}>
        實際登入 email：{account ? toEmail(account) : "（輸入帳號後顯示）"}
      </div>
    </form>
  );
}

const panel = { background:"#fff", border:"1px solid #eee", borderRadius:12, padding:16, width:360 };
const input = { width:"100%", padding:"10px 12px", border:"1px solid #ddd", borderRadius:10, marginTop:8 };
const btn = { padding:"10px 16px", border:"2px solid #333", borderRadius:12, background:"#fff", fontWeight:800, cursor:"pointer" };
const btnPrimary = { ...btn, borderColor:"#1d4ed8", color:"#1d4ed8" };
