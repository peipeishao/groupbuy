// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref as dbRef, set } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, // 例：xxx.appspot.com
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // measurementId 可省略
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app); // 

/**
 * 檢查目前使用者是否為 admin。
 * @param {{ bootstrap?: boolean }} param0
 *  - bootstrap: 當 RTDB 還沒有任何 admins 時，將目前使用者設為第一位 admin。
 *    （對應你的 rules：admins 節點不存在時允許首位寫入）
 * @returns {Promise<boolean>} 是否為 admin
 */
export async function ensureAdmin({ bootstrap = false } = {}) {
  const u = auth.currentUser;
  if (!u) return false;

  // 已是 admin？
  const mineRef = dbRef(db, `admins/${u.uid}`);
  try {
    const mineSnap = await get(mineRef);
    if (mineSnap.exists() && mineSnap.val() === true) return true;
  } catch (_e) {
    // 忽略讀取失敗，往下嘗試 bootstrap 流程
  }

  if (!bootstrap) return false;

  // 僅在 admins 節點完全不存在時，註冊第一位 admin
  const rootRef = dbRef(db, "admins");
  const rootSnap = await get(rootRef);
  if (!rootSnap.exists()) {
    await set(mineRef, true);
    return true;
  }

  return false;
}
if (typeof window !== "undefined") {
  window.auth = auth;
  window.db = db;
}
