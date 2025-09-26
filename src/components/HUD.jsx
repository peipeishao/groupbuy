// src/components/HUD.jsx
import React, { useMemo, useState } from "react";
import { usePlayer } from "../store/playerContext.jsx";
import { useCart } from "../store/useCart.js";
import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";
import ProfileEditor from "./ProfileEditor.jsx";
import OrderHistoryModal from "./OrderHistoryModal.jsx";
import ImageButton from "./ui/ImageButton.jsx";
import AdminPanel from "./AdminPanel.jsx";
import AvatarUploadInline from "./AvatarUploadInline.jsx";
import RealNameEditor from "./hud/RealNameEditor.jsx";
import EmailBinder from "./hud/EmailBinder.jsx";
import Last5Editor from "./hud/Last5Editor.jsx";

const AVATAR_EMOJI = { bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" };

export default function HUD({ onOpenCart }) {
  let player = null;
  try { player = usePlayer(); } catch (_) {}

  const { items } = useCart();
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const cartQty = useMemo(
    () => (Array.isArray(items) ? items.reduce((s, x) => s + (Number(x.qty) || 0), 0) : 0),
    [items]
  );

  const isAnonymous = !!player?.user?.isAnonymous || !player?.user?.uid;
  const isAdmin = !!player?.isAdmin;
  const roleName = player?.roleName || (isAnonymous ? "旅人" : "玩家");
  const avatar = player?.avatar || "bunny";
  const coins = Number(player?.coins || 0);

  const avatarNode = useMemo(() => {
    const av = player?.profile?.avatar || avatar;
    const url = player?.profile?.avatarUrl || "";
    if (av === "custom" && url) {
      return (
        <img
          src={url}
          alt="me"
          style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid #e5e7eb" }}
        />
      );
    }
    return <span style={{ fontSize: 28 }}>{AVATAR_EMOJI[av] || "🙂"}</span>;
  }, [player?.profile?.avatar, player?.profile?.avatarUrl, avatar]);

  return (
    <>
      {/* 右下角 HUD */}
      <div
  style={{
    position: "fixed",
    right: "max(12px, env(safe-area-inset-right))",
    bottom: "max(12px, env(safe-area-inset-bottom))",
    zIndex: 1000,
    display: "grid",
    gap: 8,
    minWidth: 200,
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
          {avatarNode}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, lineHeight: 1.1, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
              {roleName}
            </div>
            <div style={{ fontSize: 12, color: "#475569" }}>金幣：{coins}</div>
          </div>

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

        {/* 操作列 */}
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
          {/* 購物袋 */}
          <ImageButton
            img="/buildings/button-normal.png"
            imgHover="/buildings/button-light.png"
            imgActive="/buildings/button-dark.png"
            label="購物袋"
            labelPos="center"
            labelStyle={{ fontSize: "clamp(12px, 1.6vw, 18px)" }}
            badge={cartQty}
            width={104}
            height={48}
            onClick={onOpenCart}
            title="開啟購物袋"
          />

          {/* 訂購紀錄 */}
          {!isAnonymous && (
            <ImageButton
              img="/buildings/button-normal.png"
              imgHover="/buildings/button-light.png"
              imgActive="/buildings/button-dark.png"
              label="訂購紀錄"
              labelPos="center"
              labelStyle={{ fontSize: "clamp(12px, 1.6vw, 18px)" }}
              width={104}
              height={48}
              onClick={() => setHistoryOpen(true)}
              title="查看我的訂購紀錄"
            />
          )}

          {/* 管理商品（admin） */}
          {isAdmin && !isAnonymous && (
            <ImageButton
              img={`/buildings/button-normal.png`}
              imgHover={`/buildings/button-light.png`}
              imgActive={`/buildings/button-dark.png`}
              label="管理商品"
              labelPos="center"
              labelStyle={{ fontSize: "clamp(12px, 1.6vw, 18px)" }}
              width={104}
              height={48}
              onClick={() => setAdminOpen(true)}
              title="管理商品"
            />
          )}

          {/* 登入 / 登出 */}
          {isAnonymous ? (
            <>
              <ImageButton
                img="/buildings/button-normal.png"
                imgHover="/buildings/button-light.png"
                imgActive="/buildings/button-dark.png"
                label="登入"
                labelPos="center"
                labelStyle={{ fontSize: "clamp(12px, 1.6vw, 18px)" }}
                width={104}
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
                width={104}
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
              width={104}
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
      <ProfileEditor
        open={editOpen && !isAnonymous}
  onClose={() => setEditOpen(false)}
  extraAvatarControl={<AvatarUploadInline onUploaded={() => {}} />}
  extraRealName={<RealNameEditor />}
  extraLast5={<Last5Editor />}
  extraEmailBinder={<EmailBinder />}
/>

      {/* 訂購紀錄 */}
      <OrderHistoryModal open={!isAnonymous && historyOpen} onClose={() => setHistoryOpen(false)} />

      {/* 管理商品全畫面 Modal */}
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
