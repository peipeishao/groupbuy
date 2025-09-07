// src/components/FullBleedStage.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import ImageButton from "./ui/ImageButton.jsx";

/**
 * 滿版背景 + 精準釘點（cover 對齊）
 */
const StageCtx = createContext(null);
export const useStage = () => useContext(StageCtx);

export default function FullBleedStage({ bg, baseWidth = 1920, baseHeight = 1080, children }) {
  const [rect, setRect] = useState(() => calcRect(baseWidth, baseHeight));

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setRect(calcRect(baseWidth, baseHeight)));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [baseWidth, baseHeight]);

  const ctx = useMemo(() => ({ rect, baseWidth, baseHeight }), [rect, baseWidth, baseHeight]);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, backgroundImage: `url("${bg}")`, backgroundSize: "cover", backgroundPosition: "center", zIndex: 1 }} />
      <StageCtx.Provider value={ctx}>
        <div style={{ position: "fixed", inset: 0, zIndex: 2, pointerEvents: "none" }}>{children}</div>
      </StageCtx.Provider>
    </>
  );
}

function calcRect(baseW, baseH) {
  const vw = window.innerWidth || 0;
  const vh = window.innerHeight || 0;
  if (!vw || !vh) return { vw: 0, vh: 0, drawnW: 0, drawnH: 0, offsetX: 0, offsetY: 0, scale: 1 };
  const scale = Math.max(vw / baseW, vh / baseH); // cover
  const drawnW = baseW * scale;
  const drawnH = baseH * scale;
  const offsetX = (vw - drawnW) / 2;
  const offsetY = (vh - drawnH) / 2;
  return { vw, vh, drawnW, drawnH, offsetX, offsetY, scale };
}

export function Pin({ xPct, yPct, x, y, widthRel, align = "center", children, style }) {
  const { rect } = useStage() || {};
  const xn = xPct != null ? xPct / 100 : (x != null ? x : 0.5);
  const yn = yPct != null ? yPct / 100 : (y != null ? y : 0.5);
  const left = rect.offsetX + xn * rect.drawnW;
  const top = rect.offsetY + yn * rect.drawnH;

  const alignMap = {
    center: "translate(-50%, -50%)",
    tl: "translate(0, 0)",
    tr: "translate(-100%, 0)",
    bl: "translate(0, -100%)",
    br: "translate(-100%, -100%)",
  };
  const widthPx = widthRel ? Math.max(48, rect.drawnW * widthRel) : undefined;

  return (
    <div
      style={{
        position: "fixed",
        left, top,
        transform: alignMap[align] || alignMap.center,
        pointerEvents: "auto",
        width: widthPx,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** 舊的純文字門牌（保留以相容） */
export function PlacardButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 12px",
        width: "100%",
        borderRadius: 14,
        border: "2px solid #111",
        background: "#fff",
        color: "#111",
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

/** ✅ 新增：圖片門牌（吃三態圖、寬度跟 Pin 的 widthRel 對齊） */
export function PlacardImageButton({ img, imgHover, imgActive, label, onClick }) {
  return (
    <ImageButton
      img={img}
      imgHover={imgHover}
      imgActive={imgActive}
      label={label}
      width="100%"
      height="auto"
      onClick={onClick}
      // 交給外層 Pin 決定寬度；這裡讓圖片等比鋪滿
      style={{ aspectRatio: "3 / 1.2" }} // 如果你的門牌圖有固定比例，改這裡即可
    />
  );
}
