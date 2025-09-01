// src/components/LoginModal.jsx
import React, { useState } from "react";
import { db, auth } from "../firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { ref, update, serverTimestamp, push } from "firebase/database";

// 允許的帳號字元：a-z 0-9 . _ -（其餘移除）
function normalizeUsername(input) {
  return (input || "")
    .toLowerCase()
    .replace(/\s+/g, "")           // 移除空白
    .replace(/[^a-z0-9._-]+/g, ""); // 只留安全字元
}

export default function LoginModal({ open, onDone }) {
  const [username, setUsername] = useState("");
  const [realName, setRealName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  if (!open) return null;

  const submit = async () => {
    setErr("");

    const uname = normalizeUsername(username);
    const real = realName.trim();
    const pwd = password.trim();

    if (!real || !uname || pwd.length < 6) {
      setErr("請輸入真實姓名、帳號（英數._-），且密碼至少 6 碼。");
      return;
    }

    const email = `${uname}@groupbuy.local`;

    try {
      // 先註冊，若已存在改為登入
      try {
        await createUserWithEmailAndPassword(auth, email, pwd);
      } catch (e) {
        if (e?.code === "auth/email-already-in-use") {
          await signInWithEmailAndPassword(auth, email, pwd);
        } else {
          throw e;
        }
      }

      const uid = auth.currentUser.uid;

      // 公開資料：顯示名一開始 = 真實姓名
      await update(ref(db, `playersPublic/${uid}`), {
        uid,
        roleName: real,           // 初始顯示名 = 真實姓名
        avatar: "bunny",
        x: 400, y: 300, dir: "down",
        bubble: null,
        online: true,
        updatedAt: serverTimestamp(),
      });

      // 私人資料：保存真實姓名與帳號
      await update(ref(db, `playersPrivate/${uid}`), {
        uid,
        realName: real,
        username: uname,
        updatedAt: serverTimestamp(),
      });

      // 私有更名歷程：建立首筆（from: null → to: real）
      await push(ref(db, `playersPrivate/${uid}/nameHistory`), {
        from: null,
        to: real,
        ts: serverTimestamp(),
        by: uid,
      });

      onDone?.();
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/invalid-email") {
        setErr("帳號格式不合法，請只使用英數字、點、底線、減號。");
      } else if (code === "auth/wrong-password") {
        setErr("密碼錯誤。");
      } else {
        setErr(e?.message || String(e));
      }
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0006", display: "grid", placeItems: "center", zIndex: 9999 }}>
      <div style={{ width: 380, background: "#fff", padding: 16, borderRadius: 12, border: "1px solid #eee" }}>
        <h3 style={{ marginTop: 0 }}>登入 / 註冊</h3>

        <label>真實姓名（只你和管理員可見）</label>
        <input
          value={realName}
          onChange={(e) => setRealName(e.target.value)}
          placeholder="例如：王小明"
          style={{ width: "100%", marginBottom: 8 }}
        />

        <label>帳號（英數 . _ -）</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="例如：xiaoming_01"
          style={{ width: "100%", marginBottom: 4 }}
        />
        <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
          將使用：<code>{normalizeUsername(username) || "（請輸入帳號）"}</code>@groupbuy.local
        </div>

        <label>密碼（至少 6 碼）</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 6 碼"
          style={{ width: "100%", marginBottom: 8 }}
        />

        {err && <div style={{ color: "tomato", marginBottom: 8 }}>{err}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={submit} style={{ marginLeft: "auto", fontWeight: 700 }}>
            確認
          </button>
        </div>
      </div>
    </div>
  );
}
