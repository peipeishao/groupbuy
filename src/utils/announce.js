// src/utils/announce.js — 乾淨版
import { db } from "../firebase.js";
import { ref, push } from "firebase/database";

export async function announce(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  // 寫入一筆公告；需 auth != null（匿名也算登入）
  return push(ref(db, "announcements"), { text: t, ts: Date.now() });
}
