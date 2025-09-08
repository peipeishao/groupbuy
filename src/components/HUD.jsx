// src/components/HUD.jsx
import React, { useMemo, useState } from "react";
import { usePlayer } from "../store/playerContext.jsx";
import { useCart } from "../store/useCart.js";
import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";
import ProfileEditor from "./ProfileEditor.jsx";
import OrderHistoryModal from "./OrderHistoryModal.jsx";
import ImageButton from "./ui/ImageButton.jsx";
import AdminPanel from "./AdminPanel.jsx"; // ✅ 用 AdminPanel；用 Modal 包起來顯示

const AVATAR_EMOJI = { bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" };

export default function HUD({ onOpenCart }) {
  let player = null;
  try { player = usePlayer(); } catch (_) {}

  const { items } = useCart();
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false); //

  const cartQty = useMemo(
    () => (Array.isArray(items) ? items.reduce((s, x) => s + (Number(x.qty) || 0), 0) : 0),
    [items]
  );

  const isAnonymous = !!player?.user?.isAnonymous || !player?.user?.uid;
  const isAdmin = !!player?.isAdmin; // ✅ 用這個決定是否顯示「管理商品」
  const roleName = player?.roleName || (isAnonymous ? "旅人" : "玩家");
  const avatar = player?.avatar || "bunny";
  const coins = Number(player?.coins || 0);

  return (
    <>
      {/* 固定在右下角的 HUD */}
      <div
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 1000,
          display: "grid",
          gap: 8,
          minWidth: 240,
        }}
      >
        {/* 玩家卡片 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 10,
            border: "1px solid #eee",
            borderRadius: 14,
            background: "rgba(255,255,255,.98)",
            boxShadow: "0 10px 24px rgba(0,0,0,.12)",
          }}
        >
          <div style={{ fontSize: 28 }}>{AVATAR_EMOJI[avatar] || "🙂"}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, lineHeight: 1.1, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
              {roleName}
            </div>
            <div style={{ fontSize: 12, color: "#475569" }}>金幣：{coins}</div>
          </div>

          {/* 編輯（保留文字按鈕；若要改圖，把下方換成 ImageButton 即可） */}
          {!isAnonymous && (
            <button
              onClick={() => setEditOpen(true)}
              style={{
                marginLeft: "auto",
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
              title="編輯角色"
            >
              編輯
            </button>
          )}
        </div>

        {/* 操作列：購物袋 / 訂購紀錄 / 登入 or 登出 / 切換帳號 */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: 8,
            border: "1px solid #eee",
            borderRadius: 14,
            background: "rgba(255,255,255,.98)",
            boxShadow: "0 10px 24px rgba(0,0,0,.12)",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          {/* 🛍️ 購物袋（圖片按鈕 + 徽章） */}
          <ImageButton
            img="/buildings/button-normal.png"
            imgHover="/buildings/button-light.png"
            imgActive="/buildings/button-dark.png"
            label="購物袋"
            labelPos="center"
            labelStyle={{ fontSize: "clamp(12px, 1.6vw, 18px)" }} 
            badge={cartQty}
            width={120}
            height={48}
            onClick={onOpenCart}
            title="開啟購物袋"
          />

          {/* 📜 訂購紀錄（登入者可見） */}
          {!isAnonymous && (
            <ImageButton
              img="/buildings/button-normal.png"
              imgHover="/buildings/button-light.png"
              imgActive="/buildings/button-dark.png"
              label="訂購紀錄"
              labelPos="center"
              labelStyle={{ fontSize: "clamp(12px, 1.6vw, 18px)" }} 
              width={120}
              height={48}
              onClick={() => setHistoryOpen(true)}
              title="查看我的訂購紀錄"
            />
          )}

          
          {/* ✅ 🛠️ 管理商品（只有 admin 才顯示） */}
          {isAdmin && !isAnonymous && (
            <ImageButton
              img={`/buildings/button-normal.png`}          // 常態圖
              imgHover={`/buildings/button-light.png`}   // 滑過（可省略）
              imgActive={`/buildings/button-dark.png`} 
              label="管理商品"
              labelPos="center"
              labelStyle={{ fontSize: "clamp(12px, 1.6vw, 18px)" }} 
              width={120}
              height={48}
              onClick={() => setAdminOpen(true)}
              title="管理商品"
            />
          )}

          {/* 🔐 登入 / 登出；🔄 切換帳號（匿名時） */}
          {isAnonymous ? (
            <>
              <ImageButton
                img="/buildings/button-normal.png"
                imgHover="/buildings/button-light.png"
                imgActive="/buildings/button-dark.png"
                label="登入"
                labelPos="center"
                labelStyle={{ fontSize: "clamp(12px, 1.6vw, 18px)" }} 
                width={120}
                height={48}
                onClick={() => player?.openLoginGate?.()}
                title="登入或建立帳號（升級匿名帳號，購物袋保留）"
              />
              <ImageButton
                img="/buildings/button-normal.png"
                imgHover="/buildings/button-light.png"
                imgActive="/buildings/button-dark.png"
                label="建立帳號"
                labelPos="center"
                labelStyle={{ fontSize: "clamp(12px, 1.6vw, 18px)" }} 
                width={120}
                height={48}
                onClick={async () => {
                  if (player?.logoutAndGoAnonymous) {
                    await player.logoutAndGoAnonymous();
                  } else {
                    await signOut(auth);
                  }
                  player?.openLoginGate?.();
                }}
                title="以另一個帳號登入"
              />
            </>
          ) : (
            <ImageButton
              img="/buildings/button-normal.png"
              imgHover="/buildings/button-light.png"
              imgActive="/buildings/button-dark.png"
              label="登出"
              labelPos="center"
              labelStyle={{ fontSize: "clamp(12px, 1.6vw, 18px)" }} 
              width={120}
              height={48}
              onClick={async () => {
                if (player?.logoutAndGoAnonymous) {
                  await player.logoutAndGoAnonymous();
                } else {
                  await signOut(auth);
                }
              }}
              title="登出並回到匿名模式"
            />
          )}
        </div>
      </div>

      {/* 編輯角色（僅登入者可見） */}
      <ProfileEditor open={editOpen && !isAnonymous} onClose={() => setEditOpen(false)} />

      {/* 訂購紀錄（僅登入者可見） */}
      <OrderHistoryModal open={!isAnonymous && historyOpen} onClose={() => setHistoryOpen(false)} />
    {/* ✅ 管理商品（全畫面 Modal，保證可見 & 可關閉） */}
      {adminOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            zIndex: 2000,
            display: "grid",
            placeItems: "center",
            padding: 12,
          }}
        >
          <div style={{ position: "absolute", inset: 0, overflow: "auto" }}>
            <AdminPanel />
          </div>
          <button
            onClick={() => setAdminOpen(false)}
            title="關閉"
            style={{
              position: "fixed",
              right: 18,
              top: 18,
              zIndex: 2001,
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 10px 24px rgba(0,0,0,.16)",
            }}
          >
            關閉
          </button>
        </div>
      )}
    </>
  );
}