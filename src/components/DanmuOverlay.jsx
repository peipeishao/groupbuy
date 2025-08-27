// src/components/DanmuOverlay.jsx
import React, { useEffect, useState } from "react";
import "./DanmuOverlay.css"; // 記得建立對應 CSS 檔

export default function DanmuOverlay() {
  const [danmus, setDanmus] = useState([]);

  useEffect(() => {
    function handler(e) {
      const payload = e.detail;
      setDanmus((prev) => [...prev, payload]);

      // 過 duration 秒後清掉這筆彈幕
      setTimeout(() => {
        setDanmus((prev) => prev.filter((d) => d.id !== payload.id));
      }, (payload.duration || 8) * 1000);
    }

    window.addEventListener("gb_danmu", handler);
    return () => window.removeEventListener("gb_danmu", handler);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      {danmus.map((d) => (
        <div
          key={d.id}
          className={`danmu-item ${d.type === "order" ? "danmu-order" : "danmu-chat"}`}
          style={{
            top: d.top,
            animationDuration: (d.duration || 8) + "s",
          }}
        >
          {d.text}
        </div>
      ))}
    </div>
  );
}
