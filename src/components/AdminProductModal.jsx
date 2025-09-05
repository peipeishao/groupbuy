// src/components/AdminProductModal.jsx
import React from "react";
import { usePlayer } from "../store/playerContext.jsx";
import AdminPanel from "./AdminPanel.jsx"; // 直接重用你的 AdminPanel

export default function AdminProductModal({ open, onClose }) {
  const { isAdmin } = usePlayer() || {};
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 96vw)",
          height: "min(88vh, 920px)",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #eee",
          boxShadow: "0 20px 48px rgba(0,0,0,.2)",
          display: "grid",
          gridTemplateRows: "56px 1fr",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            borderBottom: "1px solid #eee",
            background: "#f9fafb",
          }}
        >
          <div style={{ fontWeight: 800 }}>管理商品</div>
          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "2px solid #333",
              background: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            關閉
          </button>
        </div>

        <div style={{ overflow: "auto" }}>
          {isAdmin ? (
            <AdminPanel />
          ) : (
            <div
              style={{
                margin: 16,
                padding: 16,
                background: "#fff8f0",
                border: "1px solid #fde68a",
                borderRadius: 12,
                color: "#92400e",
                fontWeight: 700,
              }}
            >
              需要管理員權限才能使用此面板。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
