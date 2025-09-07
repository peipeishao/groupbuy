// src/components/ui/ImageButton.jsx
import React, { useState } from "react";

/**
 * 通用圖片按鈕（進階版）
 * props:
 *  - img, imgHover?, imgActive?：三態圖片
 *  - width, height：按鈕尺寸（px）
 *  - label：疊字（圖片沒寫字時很實用）
 *  - labelPos："center" | "bottom" | "top"（預設 center）
 *  - labelStyle：覆蓋疊字樣式（例如顏色、字級）
 *  - badge：右上角徽章（數字或文字）
 *  - disabled, onClick, title, style：常規
 */
export default function ImageButton({
  img,
  imgHover,
  imgActive,
  width = 120,
  height = 48,
  label,
  labelPos = "center",
  labelStyle = {},
  badge,
  disabled = false,
  onClick,
  style = {},
  title,
}) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);

  const src = active ? (imgActive || imgHover || img) : hover ? (imgHover || img) : img;
  const filter = disabled ? "grayscale(100%) opacity(.6)" : "none";

  const baseLabel = {
    position: "absolute",
    left: 0,
    right: 0,
    color: "#ffffffff",
    fontWeight: 1200,
    // 讓文字在各種底色都有可讀性
    textShadow: "0 1px 0 #2e0606ff, 0 0 10px rgba(66, 4, 4, 0.65)",
    pointerEvents: "none",
    userSelect: "none",
    whiteSpace: "nowrap",
  };
  const posStyle =
    labelPos === "top"
      ? { top: 6, textAlign: "center" }
      : labelPos === "bottom"
      ? { bottom: 6, textAlign: "center" }
      : { inset: 0, display: "grid", placeItems: "center" }; // center

  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title || (typeof label === "string" ? label : undefined)}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        position: "relative",
        display: "inline-block",
        width,
        height,
        border: "none",
        padding: 0,
        background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        outline: "none",
        transform: active ? "scale(.97)" : "none",
        transition: "transform 80ms",
        ...style,
      }}
    >
      {/* 圖片層 */}
      <img
        src={src}
        alt={typeof label === "string" ? label : "button"}
        style={{ width: "100%", height: "100%", objectFit: "contain", filter, display: "block" }}
        draggable={false}
      />

      {/* 疊字（可選） */}
      {label ? <div style={{ ...baseLabel, ...posStyle, ...labelStyle }}>{label}</div> : null}

      {/* 徽章（右上角） */}
      {badge != null && badge !== false ? (
        <div
          style={{
            position: "absolute",
            top: -6,
            right: -8,
            minWidth: 22,
            height: 22,
            padding: "0 6px",
            borderRadius: 999,
            background: "#ef4444",
            color: "#fff",
            fontSize: 12,
            fontWeight: 900,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,.25)",
            pointerEvents: "none",
          }}
        >
          {badge}
        </div>
      ) : null}
    </button>
  );
}
