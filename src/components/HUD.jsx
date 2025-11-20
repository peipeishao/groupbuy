// src/components/HUD.jsx
import React, { useState, useMemo } from "react";
import { usePlayer } from "../store/playerContext.jsx";
import { useCart } from "../store/useCart.js";
import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";

import ProfileEditor from "./ProfileEditor.jsx";
import OrderHistoryModal from "./OrderHistoryModal.jsx";
import AdminPanel from "./AdminPanel.jsx";
import AvatarUploadInline from "./AvatarUploadInline.jsx";
import RealNameEditor from "./hud/RealNameEditor.jsx";
import EmailBinder from "./hud/EmailBinder.jsx";
import Last5Editor from "./hud/Last5Editor.jsx";
import PetWindow from "../features/pet/PetWindow.jsx";

import TownHeader from "./TownHeader.jsx";

// 依照 pet 狀態取得寵物頭像（之後可擴充）
function getPetAvatarSprite(pet) {
  if (!pet) return "";
  const color = pet.color || "pink"; // 預設粉色
  return `/pets/pet-${color}.png`;   // 圖放 public/pets/pet-pink.png 等
}

export default function HUD({ onOpenCart }) {
  let player = null;
  try {
    player = usePlayer();
  } catch (_) {}

  const { items } = useCart();

  // Modal 狀態
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [petOpen, setPetOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);

  // 購物車數量
  const cartQty = useMemo(
    () =>
      Array.isArray(items)
        ? items.reduce((s, x) => s + (Number(x.qty) || 0), 0)
        : 0,
    [items]
  );

  const isAnonymous = !!player?.user?.isAnonymous || !player?.user?.uid;
  const isAdmin = !!player?.isAdmin;

  // 玩家名稱：未登入時會是「旅人」
  const baseRoleName = "旅人";
  const displayName =
    (!isAnonymous &&
      (player?.profile?.displayName ||
        player?.profile?.realName ||
        player?.roleName)) ||
    baseRoleName;

  // 金幣
  const coins = Number(player?.coins || 0);

  // 玩家頭像（custom 且有 url 才顯示圖片）
  const playerAvatarSrc = (() => {
    const av = player?.profile?.avatar || player?.avatar || "bunny";
    const url = player?.profile?.avatarUrl || "";
    if (av === "custom" && url) return url;
    return "";
  })();

  // 寵物資料
 const pet = player?.pet;
const petAvatarSrc = getPetAvatarSprite(pet);
const petLevel = Number(pet?.level || 1);
const petExp = Number(pet?.expPct || 0);

// 🐾 優先顯示玩家幫寵物取的名字，沒有再 fallback 成「便便寶」
const petName =
  pet?.displayName ||    // 例如：玩家在寵物系統自訂的名字
  pet?.nickname ||       // 或你後端用 nickname 命名
  pet?.name ||           // 或一般 name 欄位
  "便便寶";              // 都沒有才退回便便寶（種類）

  // 登出
  async function handleLogout() {
    if (player?.logoutAndGoAnonymous) {
      await player.logoutAndGoAnonymous();
    } else {
      await signOut(auth);
    }
    setSettingsMenuOpen(false);
  }

  const openLogin = () => {
    player?.openLoginGate?.();
  };

  return (
    <>
      {/* 左上角 HUD 容器 */}
      <div
        style={{
          position: "fixed",
          left: "max(8px, env(safe-area-inset-left))",
          top: "max(8px, env(safe-area-inset-top))",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {/* 上方木板 Header */}
        <TownHeader
          playerName={player?.roleName || "旅人"}
          playerAvatarSrc={playerAvatarSrc}
          petAvatarSrc={petAvatarSrc}
          petName={petName}
          petLevel={petLevel}
          petExp={petExp}
          cartCount={cartQty}
          isAnonymous={isAnonymous}
          onClickLogin={openLogin}
          onOpenSettings={() => {
            if (isAnonymous) {
              openLogin();
            } else {
              setSettingsMenuOpen((s) => !s);
            }
          }}
          onOpenCart={onOpenCart}
          onOpenOrders={() => {
            if (!isAnonymous) setHistoryOpen(true);
            else openLogin();
          }}
          onOpenBag={() => {}}
          onOpenPet={() => {
            if (!isAnonymous) setPetOpen(true);
            else openLogin();
          }}
          showAdmin={isAdmin && !isAnonymous}
          onOpenAdmin={() => setAdminOpen(true)}
        />

        {/* 金幣顯示（依你需求可保留/之後再移位） */}
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 12,
              background: "rgba(255,255,255,0.9)",
              borderRadius: 999,
              padding: "3px 8px",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            金幣：{coins}
          </span>
        </div>
      </div>

      {/* 設定下拉選單（登入後點設定才會出現） */}
      {!isAnonymous && settingsMenuOpen && (
        <div
          style={{
            position: "fixed",
            left: "max(8px, env(safe-area-inset-left))",
            top: "calc(max(8px, env(safe-area-inset-top)) + 96px)",
            zIndex: 1100,
            background: "rgba(255,255,255,0.97)",
            borderRadius: 12,
            boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
            padding: 8,
            minWidth: 140,
          }}
        >
          <button
            type="button"
            style={settingsItemStyle}
            onClick={() => {
              setEditOpen(true);
              setSettingsMenuOpen(false);
            }}
          >
            個人資料
          </button>
          <button
            type="button"
            style={settingsItemStyle}
            onClick={handleLogout}
          >
            登出
          </button>
        </div>
      )}

      {/* === 以下：原本 HUD 的各種 modal 功能 === */}

      <ProfileEditor
        open={editOpen && !isAnonymous}
        onClose={() => setEditOpen(false)}
        extraAvatarControl={<AvatarUploadInline onUploaded={() => {}} />}
        extraRealName={<RealNameEditor />}
        extraLast5={<Last5Editor />}
        extraEmailBinder={<EmailBinder />}
      />

      <OrderHistoryModal
        open={!isAnonymous && historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      <PetWindow
        open={!isAnonymous && petOpen}
        onClose={() => setPetOpen(false)}
        meUid={player?.user?.uid}
      />

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
            style={closeBtnStyle}
          >
            關閉
          </button>
        </div>
      )}
    </>
  );
}

const settingsItemStyle = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "6px 10px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  fontSize: 13,
  cursor: "pointer",
};

const closeBtnStyle = {
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
};
