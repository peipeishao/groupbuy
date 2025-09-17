// src/components/AvatarUploadInline.jsx
import React, { useRef, useState } from "react";
import { auth, db } from "../firebase.js";
import { ref as dbRef, update } from "firebase/database";

/** 讀檔→裁切成正方形→壓縮成 webp/jpg 的 Data URL（~<=100KB） */
async function fileToDataUrlSquare(file, target = 160) {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    throw new Error("請上傳 PNG / JPG / WEBP 圖片");
  }
  const bmp = await new Promise((resolve, reject) => {
    if ("createImageBitmap" in window) {
      createImageBitmap(file).then(resolve).catch(reject);
    } else {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    }
  });
  const w = bmp.width, h = bmp.height;
  if (!w || !h) throw new Error("圖片讀取失敗");
  const size = Math.min(w, h);
  const sx = Math.floor((w - size) / 2);
  const sy = Math.floor((h - size) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, size, size, 0, 0, target, target);

  for (const type of ["image/webp", "image/jpeg"]) {
    for (const q of [0.85, 0.7, 0.55, 0.4]) {
      const dataUrl = canvas.toDataURL(type, q);
      if (dataUrl.length <= 100_000) return dataUrl; // 約 <= ~73KB 檔案
    }
  }
  const fallback = canvas.toDataURL("image/jpeg", 0.6);
  if (fallback.length <= 160_000) return fallback;
  throw new Error("圖片太大，請換較小的圖片（建議 < 100KB）");
}

export default function AvatarUploadInline({ onUploaded }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !auth.currentUser) return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrlSquare(file, 160);
      await update(dbRef(db, `playersPublic/${auth.currentUser.uid}`), {
        avatar: "custom",
        avatarUrl: dataUrl,
        updatedAt: Date.now(),
      });
      onUploaded?.(); // 通知外層把 radio/狀態切到 custom
    } catch (err) {
      alert(err?.message || "上傳失敗，請換一張較小的圖片");
      console.warn(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={onPick}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={busy}
        style={{
          padding: "6px 10px",
          border: "2px solid #111",
          borderRadius: 10,
          background: "#fff",
          fontWeight: 800,
          cursor: busy ? "not-allowed" : "pointer",
        }}
        title="上傳自訂頭像（會自動裁切壓縮）"
      >
        {busy ? "處理中…" : "上傳頭像"}
      </button>
    </span>
  );
}
