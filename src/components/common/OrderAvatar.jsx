import React, { useEffect, useState } from "react";
import { db } from "../../firebase.js";
import { ref, onValue } from "firebase/database";

/**
 * 以「訂單下單當下的快照」顯示頭像：
 * - 先用 order.orderedBy.avatarUrl
 * - 若是 custom 但沒有 avatarUrl，保底去抓 playersPublic/{uid}/avatarUrl 顯示（只讀，不回寫）
 * - 再不行就用 emoji（或 🙂）
 */
export default function OrderAvatar({ order, size = 32, rounded = "50%" }) {
  const ob = order?.orderedBy || {};
  const avatarKey = String(ob.avatar || "bunny");
  const snapUrl = ob.avatarUrl || null;
  const label = ob.roleName || "avatar";
  const uid = ob.uid || null;

  const [fallbackUrl, setFallbackUrl] = useState(null);

  useEffect(() => {
    // 只有在「是 custom 且訂單沒帶 avatarUrl，但有 uid」時才去抓一次公檔頭像
    if (snapUrl || avatarKey !== "custom" || !uid) return;
    const uref = ref(db, `playersPublic/${uid}/avatarUrl`);
    const off = onValue(
      uref,
      (s) => {
        const v = s.val();
        if (v && typeof v === "string") setFallbackUrl(v);
      },
      { onlyOnce: true }
    );
    return () => off();
  }, [snapUrl, avatarKey, uid]);

  const url = snapUrl || fallbackUrl;

  // 若有圖就顯示
  if (url) {
    return (
      <img
        src={url}
        alt={label}
        style={{ width: size, height: size, borderRadius: rounded, objectFit: "cover", display: "block" }}
      />
    );
  }

  // emoji 後備
  const emojiFallback = { bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" };
  const emoji = emojiFallback[avatarKey] || "🙂";

  return (
    <div
      title={avatarKey}
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        display: "grid",
        placeItems: "center",
        fontSize: Math.max(14, Math.floor(size * 0.6)),
        background: "#f1f5f9",
      }}
    >
      {emoji}
    </div>
  );
}
