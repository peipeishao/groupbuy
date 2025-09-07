// src/components/ResponsiveStage.jsx
import React from "react";

/**
 * ResponsiveStage
 * - 讓背景圖以「固定基準尺寸（baseWidth/baseHeight）」按比例縮放
 * - 在其上以「百分比座標」擺放子元素，避免視窗改變導致偏位
 *
 * 用法：
 * <ResponsiveStage bg={url} baseWidth={1920} baseHeight={1080}>
 *   <Pin xPct={22.4} yPct={62.8}>
 *     <PlacardButton label="雞胸肉" onClick={...} widthPct={12} />
 *   </Pin>
 * </ResponsiveStage>
 */
export default function ResponsiveStage({ bg, baseWidth = 1920, baseHeight = 1080, children, style }) {
  const ratio = `${baseWidth} / ${baseHeight}`;
  return (
    <div
      style={{
        position: "relative",
        width: "min(1280px, 96vw)",
        aspectRatio: ratio,
        backgroundImage: `url("${bg}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: 18,
        border: "1px solid #e6d6b6",
        boxShadow: "0 18px 36px rgba(0,0,0,.18)",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* overlay 容器 */}
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </div>
  );
}

export function Pin({ xPct, yPct, children, align = "center" }) {
  const alignMap = {
    center: "translate(-50%, -50%)",
    tl: "translate(0, 0)",
    tr: "translate(-100%, 0)",
    bl: "translate(0, -100%)",
    br: "translate(-100%, -100%)",
  };
  return (
    <div
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: alignMap[align] || alignMap.center,
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}

export function PlacardButton({ label, onClick, widthPct = 12, color = "#111" }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: `${widthPct}%`,
        minWidth: 80,
        padding: "10px 12px",
        borderRadius: 14,
        border: "2px solid #111",
        background: "#fff",
        color: color,
        fontWeight: 900,
        cursor: "pointer",
        boxShadow: "0 6px 18px rgba(0,0,0,.2)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
