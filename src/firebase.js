// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";
import { getAuth } from "firebase/auth";

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

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// 嘗試把目前登入者加入 admins
export async function ensureAdmin() {
  const user = auth.currentUser;
  if (!user) return;
  const uid = user.uid; // 取目前登入者 UID
  try {
    await set(ref(db, `admins/${uid}`), true);
    console.log("✅ 已將自己加入 admins：", uid);
  } catch (err) {
    console.error("❌ 新增 admin 失敗：", err);
  }
}


