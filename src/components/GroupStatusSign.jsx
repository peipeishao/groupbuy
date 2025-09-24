// src/components/GroupStatusSign.jsx
import React, { useEffect, useMemo, useState } from "react";

export default function GroupStatusSign({
  title = "本次開團",
  openAt,
  closeAt,
  arriveAt,
  statusOverride,
  showCountdown = false,
  style = {},
  hideTitle = false,
  rowGap = 6,        // 三列之間的距離
  rowPaddingY = 4,   // 每列上下內距
  labelWidth = 96,   // 左欄寬度
  sectionGap = 10,   // 吊牌與資訊區塊之間的距離
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const toMs = (v) =>
    v instanceof Date ? v.getTime() : v == null ? undefined : Number(v) || new Date(v).getTime();

  const openMs = toMs(openAt);
  const closeMs = toMs(closeAt);
  const arriveMs = toMs(arriveAt);

  const computedOpen = useMemo(() => {
    // 多支援 "ended" 也視為關閉
    if (statusOverride === "open") return true;
    if (statusOverride === "closed" || statusOverride === "ended") return false;
    if (!openMs && !closeMs) return true;
    if (openMs && now < openMs) return false;
    if (closeMs && now >= closeMs) return false;
    return true;
  }, [statusOverride, openMs, closeMs, now]);

  const remain = useMemo(() => {
    if (!showCountdown || !closeMs) return null;
    const d = Math.max(0, closeMs - now);
    const sec = Math.floor(d / 1000);
    const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }, [closeMs, now, showCountdown]);

  // ── 顏色調整：Open 用綠、Closed 改為「灰色」 ───────────────────────────
  const OPEN_PALETTE   = { bg: "#114d2a", edge: "#0b3b1f", text: "#ffffff", sub: "#d1fae5" };
  const CLOSED_PALETTE = { bg: "#6b7280", edge: "#4b5563", text: "#f3f4f6", sub: "#e5e7eb" }; // 灰色系

  const palette = computedOpen ? OPEN_PALETTE : CLOSED_PALETTE;

  const boardWidth = 400;
  const boardHeight = 100;

  return (
    <div style={{ ...wrap, ...style }} aria-live="polite" aria-label={computedOpen ? "Open" : "Closed"}>
      {!hideTitle && !!title && (
        <div style={{ fontSize: 14, color: "#334155", marginBottom: 8 }}>{title}</div>
      )}

      <svg
        role="img"
        width="100%"
        viewBox={`0 0 ${boardWidth} ${boardHeight + 80}`}
        style={{ maxWidth: 560, display: "block", marginBottom: sectionGap }}
      >
        <circle cx={boardWidth / 2} cy={16} r="6" fill="#1f2937" />
        <circle cx={boardWidth / 2} cy={16} r="10" fill="none" stroke="#9ca3af" strokeWidth="2" />
        <line x1={boardWidth / 2} y1={18} x2={60} y2={60} stroke="#6b7280" strokeWidth="3" />
        <line x1={boardWidth / 2} y1={18} x2={boardWidth - 60} y2={60} stroke="#6b7280" strokeWidth="3" />
        <rect x="18" y="60" rx="16" ry="16" width={boardWidth - 36} height={boardHeight} fill="#00000022" />
        <defs>
          <linearGradient id="rust" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.bg} />
            <stop offset="100%" stopColor={palette.edge} />
          </linearGradient>
          <pattern id="grunge" patternUnits="userSpaceOnUse" width="10" height="10">
            <rect width="10" height="10" fill="transparent" />
            <circle cx="2" cy="2" r="1" fill="#00000022" />
            <circle cx="8" cy="6" r="1" fill="#ffffff18" />
            <circle cx="5" cy="9" r="1" fill="#00000022" />
          </pattern>
        </defs>
        <rect x="12" y="54" rx="16" ry="16" width={boardWidth - 24} height={boardHeight} fill="url(#rust)" stroke="#111827" strokeWidth="3" />
        <rect x="12" y="54" rx="16" ry="16" width={boardWidth - 24} height={boardHeight} fill="url(#grunge)" opacity="0.18" />
        <text x={boardWidth / 2} y={80} textAnchor="middle" style={{ fontSize: 22, fontWeight: 700, fill: palette.sub, letterSpacing: 1 }}>
          {computedOpen ? "COME IN • WE'RE" : "SORRY • WE'RE"}
        </text>
        <text x={boardWidth / 2} y={138} textAnchor="middle" style={{ fontSize: 64, fontWeight: 900, fill: palette.text, paintOrder: "stroke", stroke: "#00000055", strokeWidth: 3, letterSpacing: 3 }}>
          {computedOpen ? "OPEN" : "CLOSED"}
        </text>
      </svg>

      {/* 三列資訊：白色底板 */}
      <div style={infoCol(rowGap)}>
        <InfoV label="開團時間" value={fmt(openMs)} lblW={labelWidth} padY={rowPaddingY} />
        <InfoV label="收單時間" value={fmt(closeMs)} lblW={labelWidth} padY={rowPaddingY} />
        <InfoV label="貨到時間" value={fmt(arriveMs)} lblW={labelWidth} padY={rowPaddingY} />
      </div>

      {computedOpen && remain && (
        <div style={{ marginTop: 6, fontSize: 13, color: "#00040eff" }}>
          距離收單：<b style={{ fontVariantNumeric: "tabular-nums" }}>{remain}</b>
        </div>
      )}

      {!computedOpen && openMs && now < openMs && (
        <div style={{ marginTop: 6, fontSize: 13, color: "#334155" }}>
          尚未開始，預計 <b>{fmt(openMs)}</b> 開團
        </div>
      )}
      {!computedOpen && closeMs && now >= closeMs && (
        <div style={{ marginTop: 6, fontSize: 13, color: "#334155" }}>
          本次已收單結束
        </div>
      )}
    </div>
  );
}

// ── 小工具們 ──────────────────────────────────────────────────────────────
function fmt(ms) {
  if (!ms) return "—";
  const d = new Date(ms);
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${M}/${D} ${h}:${m}`;
}

function InfoV({ label, value, lblW, padY }) {
  return (
    <div style={infoRowItem(lblW, padY)}>
      <div style={infoLabel}>{label}</div>
      <div style={infoValue}>{value}</div>
    </div>
  );
}

const wrap = {
  border: "none",
  borderRadius: 0,
  background: "transparent",
  padding: 0,
  display: "grid",
  gap: 0,
  justifyItems: "center",
  textAlign: "center",
};

const infoCol = (gap) => ({
  marginTop: 6,
  display: "grid",
  gridTemplateColumns: "1fr",
  gap,
  width: "100%",
});

const infoRowItem = (lblW, padY) => ({
  display: "grid",
  gridTemplateColumns: `${lblW}px 1fr`,
  alignItems: "center",
  padding: `${padY + 2}px 10px`,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#ffffff",
  boxShadow: "0 1px 0 rgba(0,0,0,.02)",
});

const infoLabel = {
  fontSize: 12,
  color: "#0d042cff",
  textAlign: "left",
};

const infoValue = {
  fontSize: 12,
  fontWeight: 800,
  color: "#9b0000ff",
  textAlign: "right",
  lineHeight: 1.2,
  whiteSpace: "normal",
  wordBreak: "break-word",
};
