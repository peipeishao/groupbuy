import React, { useState } from "react";
import {
  browserLocalPersistence,
  setPersistence,
  createUserWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth, db } from "../../firebase.js";
import { ref as dbRef, update, get, set } from "firebase/database";

// 帳號轉 email
function toEmail(account) {
  if (!account) return "";
  return account.includes("@") ? account : `${account}@groupbuy.local`;
}

// 驗證帳號（英數，對應 playersPrivate.username 規則）
function isValidAccountId(s) {
  return /^[A-Za-z0-9]+$/.test(s || "");
}

export default function Signup({ onClose, goLogin, resumeAction }) {
  const [account, setAccount] = useState("");   // 只輸入前半（例：peishao）
  const [realName, setRealName] = useState(""); // 必填
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const ensurePrivateProfile = async (uid, username, realName) => {
    const priRef = dbRef(db, `playersPrivate/${uid}`);
    const now = Date.now();
    // 直接做一次更新（若不存在 PlayerProvider 也會建，但這裡先補真實姓名/帳號）
    await update(priRef, {
      uid,
      username,        // 規則：英數
      realName,        // 規則：字串即可
      updatedAt: now,
    });
  };

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    if (!account || !password || !realName) {
      return alert("請輸入帳號、密碼與真實姓名");
    }
    if (!isValidAccountId(account)) {
      return alert("帳號僅能包含英文字母與數字");
    }

    const email = toEmail(account);
    setLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);

      if (auth.currentUser?.isAnonymous) {
        // 匿名升級（保留 uid，不需搬移 carts）
        const cred = EmailAuthProvider.credential(email, password);
        const { user } = await linkWithCredential(auth.currentUser, cred);
        await ensurePrivateProfile(user.uid, account, realName);
      } else {
        // 非匿名直接建立新帳號（較少見）
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await ensurePrivateProfile(user.uid, account, realName);
      }

      onClose?.();
      resumeAction?.();
    } catch (err) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        alert("此帳號已被註冊，請改用登入。");
      } else if (code === "auth/weak-password") {
        alert("密碼至少 6 碼。");
      } else {
        alert(err.message || code);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={panel}>
      <h3 style={{marginTop:0}}>建立帳號</h3>
      <input
        placeholder="帳號（英數，將轉為 @groupbuy.local）"
        value={account}
        onChange={(e)=>setAccount(e.target.value)}
        style={input}
      />
      <input
        placeholder="真實姓名（下單會顯示）"
        value={realName}
        onChange={(e)=>setRealName(e.target.value)}
        style={input}
      />
      <input
        type="password"
        placeholder="密碼（至少 6 碼）"
        value={password}
        onChange={(e)=>setPassword(e.target.value)}
        style={input}
      />
      <div style={{ display:"flex", gap:8, marginTop:8 }}>
        <button type="submit" disabled={loading} style={btnPrimary}>{loading ? "建立中…" : "建立帳號"}</button>
        <button type="button" onClick={goLogin} style={btn}>改用登入</button>
      </div>
      <div style={{fontSize:12, color:"#666", marginTop:8}}>
        實際建立 email：{account ? toEmail(account) : "（輸入帳號後顯示）"}
      </div>
    </form>
  );
}

const panel = { background:"#fff", border:"1px solid #eee", borderRadius:12, padding:16, width:360 };
const input = { width:"100%", padding:"10px 12px", border:"1px solid #ddd", borderRadius:10, marginTop:8 };
const btn = { padding:"10px 16px", border:"2px solid #333", borderRadius:12, background:"#fff", fontWeight:800, cursor:"pointer" };
const btnPrimary = { ...btn, borderColor:"#16a34a", color:"#16a34a" };
