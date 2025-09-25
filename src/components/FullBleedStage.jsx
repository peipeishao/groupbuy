// src/components/FullBleedStage.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import ImageButton from "./ui/ImageButton.jsx";

/**
 * 滿版背景 + 精準釘點（cover 對齊，行動裝置更穩定）
 * - 使用 VisualViewport（可用時）避免 iOS 位址列收合造成高度跳動
 * - 內建 safe-area 邊距，避免與瀏海/底部條重疊
 */
const StageCtx = createContext(null);
export const useStage = () => useContext(StageCtx);

export default function FullBleedStage({ bg, baseWidth = 1920, baseHeight = 1080, children }) {
  const [rect, setRect] = useState(() => calcRect(baseWidth, baseHeight));

  useEffect(() => {
    let raf = 0;

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setRect(calcRect(baseWidth, baseHeight)));
    };

    // 視窗尺寸改變
    window.addEventListener("resize", schedule, { passive: true });

    // 行動裝置位址列收合（VisualViewport）
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", schedule, { passive: true });
      vv.addEventListener("scroll", schedule, { passive: true });
    }

    // 初始化
    schedule();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      if (vv) {
        vv.removeEventListener("resize", schedule);
        vv.removeEventListener("scroll", schedule);
      }
    };
  }, [baseWidth, baseHeight]);

  const ctx = useMemo(() => ({ rect, baseWidth, baseHeight }), [rect, baseWidth, baseHeight]);

  return (
    <>
      {/* 背景：cover 填滿視窗 */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `url("${bg}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          zIndex: 1,
        }}
      />

      {/* 釘點層：提供 safe-area 邊距，避免與瀏海/底部條重疊 */}
      <StageCtx.Provider value={ctx}>
        <div
          style={{
            position: "fixed",
            inset: 0,
            paddingTop: "env(safe-area-inset-top)",
            paddingRight: "env(safe-area-inset-right)",
            paddingBottom: "env(safe-area-inset-bottom)",
            paddingLeft: "env(safe-area-inset-left)",
            zIndex: 2,
            pointerEvents: "none", // 由子元素自行開啟
          }}
        >
          {children}
        </div>
      </StageCtx.Provider>
    </>
  );
}

function calcRect(baseW, baseH) {
  // 優先用 VisualViewport，fallback 到 window
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const vw = Math.max(0, Math.floor((vv?.width ?? window.innerWidth) || 0));
  const vh = Math.max(0, Math.floor((vv?.height ?? window.innerHeight) || 0));
  if (!vw || !vh) return { vw: 0, vh: 0, drawnW: 0, drawnH: 0, offsetX: 0, offsetY: 0, scale: 1 };

  // cover 縮放：等比放大到覆蓋整個視窗
  const scale = Math.max(vw / baseW, vh / baseH);
  const drawnW = baseW * scale;
  const drawnH = baseH * scale;
  const offsetX = (vw - drawnW) / 2;
  const offsetY = (vh - drawnH) / 2;

  return { vw, vh, drawnW, drawnH, offsetX, offsetY, scale };
}

/**
 * 釘點：依據「原始設計座標」百分比定位到 cover 後的正確位置
 * - xPct / yPct：以原圖寬高的百分比（0~100）定位（建議）
 * - x / y：以 0~1 的比例定位（可選，與 xPct/yPct 擇一）
 * - widthRel：寬度占原圖寬度的比例（0~1），會隨 cover 比例縮放
 * - align：對齊（center / tl / tr / bl / br）
 */
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
  const widthPx = widthRel ? Math.max(44, rect.drawnW * widthRel) : undefined;

  return (
    <div
      style={{
        position: "fixed",      // 固定於視窗，避免父層捲動影響
        left,
        top,
        transform: alignMap[align] || alignMap.center,
        pointerEvents: "auto",  // 讓按鈕可點擊
        width: widthPx,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** 舊的純文字門牌（保留相容） */
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

/** 圖片門牌（三態） */
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
      style={{ aspectRatio: "3 / 1.2" }}
    />
  );
}
