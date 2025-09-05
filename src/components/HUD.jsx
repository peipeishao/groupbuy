// src/components/HUD.jsx
import React, { useEffect, useMemo, useState } from "react";
import { usePlayer } from "../store/playerContext.jsx";
import { useCart } from "../store/useCart.js";
import ProfileEditor from "./ProfileEditor.jsx";
import AdminProductModal from "./AdminProductModal.jsx";

const AVATAR_EMOJI = { bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" };

export default function HUD({ onOpenCart }) {
  let player = null;
  try { player = usePlayer(); } catch (_) {}

  const { items } = useCart();
  const [editOpen, setEditOpen] = useState(false);
  const [pmOpen, setPmOpen] = useState(false); // 管理商品面板

  const cartQty = useMemo(() => {
    try {
      return Object.values(items || {}).reduce((sum, it) => sum + (it.qty || 0), 0);
    } catch { return 0; }
  }, [items]);

  const isAnonymous = !!player?.isAnonymous;
  const isAdmin = !!player?.isAdmin;
  const roleName = player?.roleName || "旅人";
  const avatar = player?.avatar || "bunny";
  const coins = player?.profile?.coins ?? 0;

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: "calc(16px + env(safe-area-inset-right))",
          bottom: "calc(16px + env(safe-area-inset-bottom))",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          background: "rgba(255,255,255,.95)",
          border: "1px solid #eee",
          borderRadius: 14,
          boxShadow: "0 8px 24px rgba(0,0,0,.12)",
          zIndex: 100,
          flexWrap: "wrap",
          maxWidth: "min(92vw, 620px)",
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: "#fff",
          border: "1px solid #eee", display: "grid", placeItems: "center"
        }}>
          <div style={{ fontSize: 22 }}>{AVATAR_EMOJI[avatar] || "🙂"}</div>
        </div>

        {/* Name + coins */}
        <div style={{ lineHeight: 1.2, marginRight: 6 }}>
          <div style={{ fontWeight: 800 }}>
            {roleName}{isAnonymous ? "（旅人）" : ""}
          </div>
          <div style={{ fontSize: 12, color: "#666" }}>金幣：{coins}</div>
        </div>

        {/* 編輯角色（登入者） */}
        {!isAnonymous && (
          <button
            onClick={() => setEditOpen(true)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 800, cursor: "pointer" }}
            title="編輯角色"
          >
            編輯角色
          </button>
        )}

        {/* 購物袋 */}
        <button
          onClick={() => onOpenCart?.()}
          style={{ position: "relative", padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 800, cursor: "pointer" }}
          title="購物袋"
        >
          購物袋
          {cartQty > 0 && (
            <span style={{
              position: "absolute", top: -8, right: -8, minWidth: 22, height: 22, padding: "0 6px",
              borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 12, fontWeight: 800,
              display: "grid", placeItems: "center", border: "2px solid #fff", boxShadow: "0 6px 16px rgba(0,0,0,.18)"
            }}>
              {cartQty}
            </span>
          )}
        </button>

        {/* 只有 Admin 看得到的管理商品 */}
        {isAdmin && (
          <button
            onClick={() => setPmOpen(true)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "2px solid #16a34a", background: "#fff", color: "#16a34a", fontWeight: 800, cursor: "pointer" }}
            title="開啟管理商品（僅管理員）"
          >
            管理商品
          </button>
        )}

        {/* 登入 / 登出 */}
        {isAnonymous ? (
          <button
            onClick={() => player?.openLoginGate?.({ to: "login" })}
            style={{ padding: "8px 12px", borderRadius: 10, border: "2px solid #333", background: "#fff", fontWeight: 800, cursor: "pointer" }}
            title="登入或建立帳號（將升級匿名帳號，購物袋保留）"
          >
            登入 / 建立帳號
          </button>
        ) : (
          <>
            <button
              onClick={async () => {
                if (player?.logoutAndGoAnonymous) {
                  await player.logoutAndGoAnonymous();
                }
              }}
              style={{ padding: "8px 12px", borderRadius: 10, border: "2px solid #333", background: "#fff", fontWeight: 800, cursor: "pointer" }}
              title="登出"
            >
              登出
            </button>

            <button
              onClick={() => player?.openLoginGate?.({ to: "login" })}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 800, cursor: "pointer" }}
              title="以另一個帳號登入"
            >
              切換帳號
            </button>
          </>
        )}
      </div>

      {/* 編輯角色 Modal */}
      <ProfileEditor open={editOpen && !isAnonymous} onClose={() => setEditOpen(false)} />

      {/* 管理商品 Modal（僅 admin 實際可用） */}
      <AdminProductModal open={pmOpen} onClose={() => setPmOpen(false)} />
    </>
  );
}
