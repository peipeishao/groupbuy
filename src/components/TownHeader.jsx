// src/components/TownHeader.jsx
import React from "react";
import "./TownHeader.css";

// 木板底圖（你的 HEADBOARD.png）
import panelBg from "../assets/ui/HEADBOARD.png";

// 四顆工具列 icon（請對應你的實際檔名）
import iconSettings from "../assets/icons/settings.png";
import iconCart from "../assets/icons/cart.png";
import iconOrders from "../assets/icons/historyorders.png";
import iconBag from "../assets/icons/backpack.png";

/**
 * TownHeader
 * - 上方：木板 + 玩家頭像 + 寵物頭像
 * - 中間：玩家名稱（未登入時顯示登入小字）+ 寵物名稱 + 等級條
 * - 下方：設定 / 購物車 / 歷史訂購 / 背包 /（若是 admin）商品管理
 */
export default function TownHeader({
  playerName = "旅人",
  playerAvatarSrc,
  petAvatarSrc,
  petName = "寵物",
  petLevel = 1,
  petExp = 30,
  cartCount = 0,
  isAnonymous = true,
  showAdmin = false,
  onClickLogin,
  onOpenSettings,
  onOpenCart,
  onOpenOrders,
  onOpenBag,
  onOpenAdmin,
  onOpenPet,
}) {
  const safeExp = Math.min(100, Math.max(0, petExp ?? 0));

  return (
    <header className="th-root">
      {/* 🪵 玩家資訊木板 */}
      <div
        className="th-playerPanel"
        style={{ backgroundImage: `url(${panelBg})` }}
      >
        {/* 左側雙圓：大圓玩家、小圓寵物（可點進寵物頁） */}
        <div className="th-avatarStack">
          {/* 大圓：玩家 */}
          <div className="th-avatarCircle th-avatarCircle--big">
            {playerAvatarSrc && (
              <img
                src={playerAvatarSrc}
                alt={playerName}
                className="th-avatarImgInner"
              />
            )}
          </div>

          {/* 小圓：寵物頭像（按下進寵物頁） */}
          <button
            type="button"
            className="th-avatarCircle th-avatarCircle--small th-avatarCircleBtn"
            onClick={onOpenPet}
            title={petName}
          >
            {petAvatarSrc && (
              <img
                src={petAvatarSrc}
                alt={petName}
                className="th-avatarImgInner"
              />
            )}
          </button>
        </div>

        {/* 名字 + 登入小字 + 寵物名 + 等級條 */}
        <div className="th-playerText">
          {/* 玩家名稱列：旅人 + 登入連結 */}
          <div className="th-playerNameRow">
            <div className="th-playerName">{playerName}</div>
            {isAnonymous && (
              <button
                type="button"
                className="th-loginLink"
                onClick={onClickLogin}
              >
                登入
              </button>
            )}
          </div>

          <div className="th-petName">{petName}</div>

          <div className="th-expRow">
            <div className="th-levelBadge">{petLevel}</div>
            <div className="th-expBar">
              <div
                className="th-expFill"
                style={{ width: `${safeExp}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 下方工具列：設定 / 購物車 / 歷史 / 背包 / 商品管理(admin) */}
      <div className="th-toolbarRow">
        <HeaderIconButton
          iconSrc={iconSettings}
          label="設定"
          onClick={onOpenSettings}
        />
        <HeaderIconButton
          iconSrc={iconCart}
          label="購物車"
          onClick={onOpenCart}
          showBadge={cartCount > 0}
          badgeContent={cartCount}
        />
        <HeaderIconButton
          iconSrc={iconOrders}
          label="歷史訂購"
          onClick={onOpenOrders}
        />
        <HeaderIconButton
          iconSrc={iconBag}
          label="背包"
          onClick={onOpenBag}
        />

        {showAdmin && (
          <button
            type="button"
            className="th-adminIconBtn"
            onClick={onOpenAdmin}
            aria-label="商品管理"
          >
            <div className="th-adminIconCircle">商</div>
          </button>
        )}
      </div>
    </header>
  );
}

/* 單一 icon 按鈕（用你畫的 png 當按鈕） */
function HeaderIconButton({
  iconSrc,
  label,
  showBadge = false,
  badgeContent,
  onClick,
}) {
  return (
    <button
      type="button"
      className="th-iconBtnPlain"
      onClick={onClick}
      aria-label={label}
    >
      <div className="th-iconWrapper">
        <img src={iconSrc} alt={label} className="th-iconImg" />

        {showBadge && (
          <span className="th-badgeDot">
            {typeof badgeContent === "number" && badgeContent > 0
              ? badgeContent > 99
                ? "99+"
                : badgeContent
              : ""}
          </span>
        )}
      </div>
    </button>
  );
}
