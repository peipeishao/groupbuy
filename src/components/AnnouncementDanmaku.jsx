// src/components/AnnouncementDanmaku.jsx
import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase.js";
import { ref, query, limitToLast, onChildAdded } from "firebase/database";

/**
 * 彈幕公告（右上 → 左側平移消失）
 * - lanes: 同時可見的跑道數（避免重疊）
 * - rowHeight: 跑道彼此的垂直距離（px）
 * - topOffset: 第一條跑道距離視窗頂端的距離（px）
 * - durationSec: 每條彈幕飛行時間（秒）
 */
export default function AnnouncementDanmaku({
  lanes = 4,
  rowHeight = 38,
  topOffset = 80,
  durationSec = 9,
}) {
  const [bullets, setBullets] = useState([]);
  const nextLaneRef = useRef(0);
  const lastKeyRef = useRef(null);

  // 監聽最新公告（只取最後一筆 + 後續新筆）
  useEffect(() => {
    const q = query(ref(db, "announcements"), limitToLast(1));
    const off = onChildAdded(q, (snap) => {
      const key = snap.key;
      const val = snap.val() || {};
      if (!val?.text) return;

      // 避免 HMR/重覆 key 造成重播
      if (lastKeyRef.current === key) return;
      lastKeyRef.current = key;

      const lane = nextLaneRef.current % Math.max(1, lanes);
      nextLaneRef.current += 1;

      const id = `${key}-${Date.now()}`;
      const text = String(val.text);

      setBullets((prev) => [...prev, { id, text, lane }]);

      // 在動畫結束後移除
      const ttl = Math.max(1, durationSec) * 1000 + 200;
      setTimeout(() => {
        setBullets((prev) => prev.filter((b) => b.id !== id));
      }, ttl);
    });

    return () => off();
  }, [lanes, durationSec]);

  // 內嵌 keyframes（用 transform 平移）
  const styleTag = (
    <style>
      {`
        @keyframes gb-danmaku-left {
          from { transform: translateX(0); }
          to   { transform: translateX(-120vw); }
        }
      `}
    </style>
  );

  return (
    <>
      {styleTag}
      {bullets.map((b) => {
        const top = topOffset + b.lane * rowHeight;
        return (
          <div
            key={b.id}
            aria-live="polite"
            aria-atomic="true"
            // 固定定位在畫面外右側，啟動動畫橫向左移
            style={{
              position: "fixed",
              left: "100vw",             // 從右側邊界外起跑
              top,
              zIndex: 999999,            // 確保蓋在所有面板之上
              pointerEvents: "none",
              animationName: "gb-danmaku-left",
              animationDuration: `${Math.max(1, durationSec)}s`,
              animationTimingFunction: "linear",
              animationFillMode: "forwards",
              // 視覺樣式
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "rgba(0,0,0,.78)",
              color: "#fff",
              borderRadius: 12,
              boxShadow: "0 8px 18px rgba(0,0,0,.25)",
              fontWeight: 700,
              whiteSpace: "nowrap",
              // 小小的文字陰影，提升讀性
              textShadow: "0 1px 2px rgba(0,0,0,.5)",
            }}
          >
            <span style={{ fontSize: 16 }}>📣</span>
            <span>{b.text}</span>
          </div>
        );
      })}
    </>
  );
}
