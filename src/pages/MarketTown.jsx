// src/pages/MarketTown.jsx
import React, { useState, useEffect, useRef } from "react";
import Town from "./Town.jsx";
import OrdersSummaryTable from "../components/OrdersSummaryTable.jsx";
import OrderSheetModal from "../components/OrderSheetModal.jsx";
import CartModal from "../components/CartModal.jsx";
import ChatBox from "../components/ChatBox.jsx";
import HUD from "../components/HUD.jsx";
import LoginGate from "../components/LoginGate.jsx";
import ProductManager from "../components/ProductManager.jsx";
import FullBleedStage, { Pin, PlacardImageButton } from "../components/FullBleedStage.jsx";
import AnnouncementDanmaku from "../components/AnnouncementDanmaku.jsx";
import { announce } from "../utils/announce.js";
import { auth, db } from "../firebase.js";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import StallStatusSign from "../components/StallStatusSign.jsx";

// 🐾 寵物系統（方案B）
import {
  ensurePlayerPrivate,
  ensureDefaultPetPoop,
  watchCommunityPoops,
  plantUserPoop,
  pickupWildPoop,
  distance,
} from "./petSystem";

import { ref as dbRef, onValue } from "firebase/database";

// === 行動裝置版面修正（不額外建 CSS 檔，直接 inline style） ===
const DOCK_H = 120; // 預留右下 HUD/底部元件高度，可依實際需要微調
const styles = {
  panelArea: {
    position: "fixed",
    left: "max(8px, env(safe-area-inset-left))",
    right: "max(8px, env(safe-area-inset-right))",
    top: "max(350px, env(safe-area-inset-top))",
    bottom: `calc(${DOCK_H}px + max(8px, env(safe-area-inset-bottom)))`,
    overflow: "visible",
    WebkitOverflowScrolling: "touch",
    zIndex: 10,
    pointerEvents: "auto",
  },
  toastStack: {
    position: "fixed",
    top: "max(8px, env(safe-area-inset-top))",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 30,
    display: "grid",
    gap: 6,
    pointerEvents: "none",
  },
  toastItem: { pointerEvents: "auto" },
  chatCorner: {
    position: "fixed",
    left: "max(12px, env(safe-area-inset-left))",
    bottom: `calc(${DOCK_H}px + max(12px, env(safe-area-inset-bottom)) - 120px)`,
    zIndex: 15,
  },
  card: {
    margin: "10px auto",
    width: "min(1050px, 96vw)",
    borderRadius: 14,
    border: "1px solid #eee",
    boxShadow: "0 18px 36px rgba(0,0,0,.2)",
    background: "#fff",
    padding: 8,
  },
  hScroll: {
    width: "100%",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  plantBtn: {
    position: "fixed",
    right: "max(16px, env(safe-area-inset-right))",
    bottom: `calc(${DOCK_H}px + max(16px, env(safe-area-inset-bottom)))`,
    zIndex: 16,
    padding: "10px 12px",
    borderRadius: 999,
    border: "2px solid #111",
    background: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(0,0,0,.18)",
  },
  poopIcon: {
    position: "absolute",
    width: 24,
    height: 24,
    transform: "translate(-12px, -18px)",
    pointerEvents: "none",
    filter: "drop-shadow(0 2px 2px rgba(0,0,0,.35))",
  },
};

export default function MarketTown() {
  const [openSheet, setOpenSheet] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [pmOpen, setPmOpen] = useState(false);

  // 你的玩家位置（若你已在別處有此狀態，改用你的來源）
  const [myPos, setMyPos] = useState(null);

  // 監聽自己的公開位置（示例：若你已有 playersPublic 的 hook，直接用你的）
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const off = onValue(dbRef(db, `playersPublic/${uid}`), (snap) => {
      const v = snap.val() || {};
      if (typeof v.x === "number" && typeof v.y === "number") {
        setMyPos({ x: v.x, y: v.y });
      }
    });
    return () => off();
  }, [auth.currentUser?.uid]);

  const BG_URL = "/bg-town.jpg";

  // 攤位按鈕
  const placards = [
    { id: "chicken", label: "金豐盛雞胸肉", xPct: 47.0, yPct: 12.0, widthRel: 0.10 },
    { id: "cannele", label: "C文可麗露",     xPct: 65.0, yPct: 12.0, widthRel: 0.14 },
  ];

  // 登入與玩家私有節點初始化
  useEffect(() => {
    let unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          await signInAnonymously(auth);
          return;
        }
        await ensurePlayerPrivate();
        await ensureDefaultPetPoop(); // 可選：預設給一隻便便寵物
        announce("歡迎旅人進入小鎮");
        unsub && unsub();
      } catch (e) {
        console.warn("[MarketTown] welcome/init failed:", e);
        unsub && unsub();
      }
    });
    return () => { try { unsub && unsub(); } catch {} };
  }, []);

  // 監聽所有人的「臨時便便」播種
  const [communityPoops, setCommunityPoops] = useState([]); // [{uid,id,x,y,expiresAt}]
  useEffect(() => {
    const off = watchCommunityPoops(setCommunityPoops);
    return () => off();
  }, []);

  // 靠近任一顆便便就「撿起」：背包 +1（不刪地圖點，由 expiresAt 自動過期）
  useEffect(() => {
    if (!myPos) return;
    const t = setInterval(async () => {
      // 可加：限制每秒最多撿 N 顆，這裡先簡單處理
      for (const p of communityPoops) {
        if (distance(myPos, p) <= 56) {
          // spawnId 用 `${uid}:${id}` 當唯一值
          await pickupWildPoop(`${p.uid}:${p.id}`);
        }
      }
    }, 300);
    return () => clearInterval(t);
  }, [myPos, communityPoops]);

  // 在玩家附近播種一顆臨時便便
  async function handlePlantNearMe() {
    // 前端輕量限制：自己同時有效顆數 ≤ 2
    const myUid = auth.currentUser?.uid;
    const mine = communityPoops.filter((p) => p.uid === myUid);
    if (mine.length >= 2) {
      alert("你已經種了 2 顆便便，等它們過期再種吧！");
      return;
    }
    const base = myPos || { x: 960, y: 540 };
    const jitter = () => (Math.random() * 60 - 30);
    await plantUserPoop({ x: base.x + jitter(), y: base.y + jitter() });
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* 背景與釘點（兩塊開團時間牌 + 兩顆入口按鈕） */}
      <FullBleedStage bg={BG_URL} baseWidth={1920} baseHeight={1080}>
        {/* 雞胸肉時間牌（左側上方） */}
        <Pin xPct={47} yPct={24} widthRel={0.10}>
          <div style={{ position: "relative", zIndex: 20, width: "100%" }}>
            <StallStatusSign
              stallId="chicken"
              hideTitle
              rowGap={4}
              rowPaddingY={6}
              labelWidth={88}
              sectionGap={2}
              style={{ width: "100%" }}
            />
          </div>
        </Pin>
        {/* C文可麗露時間牌（右側上方） */}
        <Pin xPct={65} yPct={24} widthRel={0.10}>
          <div style={{ position: "relative", zIndex: 20, width: "100%" }}>
            <StallStatusSign
              stallId="cannele"
              hideTitle
              rowGap={4}
              rowPaddingY={6}
              labelWidth={88}
              sectionGap={2}
              style={{ width: "100%" }}
            />
          </div>
        </Pin>
        {/* 入口按鈕 */}
        {placards.map((p) => (
          <Pin key={p.id} xPct={p.xPct} yPct={p.yPct} widthRel={p.widthRel}>
            <PlacardImageButton
              img={"/buildings/button-normal.png"}
              imgHover={"/buildings/button-light.png"}
              imgActive={"/buildings/button-dark.png"}
              label={p.label}
              onClick={() => setOpenSheet(p.id)}
            />
          </Pin>
        ))}

        {/* 在地圖層渲染大家播的便便（用 emoji 當圖示，避免缺素材） */}
        {communityPoops.map((p) => (
          <div key={`${p.uid}:${p.id}`} style={{ position: "absolute", left: p.x, top: p.y }}>
            <div style={styles.poopIcon}>💩</div>
          </div>
        ))}
      </FullBleedStage>

      {/* 小鎮層（原樣） */}
      <div style={{ position: "relative", zIndex: 3 }}>
        <Town />
      </div>

      {/* ✅ 主面板（訂單總覽）：預留底部與安全區、可內滾動，不再壓到 HUD / 聊天框 */}
      <div style={styles.panelArea}>
        <div style={styles.card}>
          <div style={styles.hScroll}>
            <OrdersSummaryTable fixedWidth="1000px" fixedHeight="400px" />
          </div>
        </div>
      </div>

      {/* ✅ 聊天框：固定左下且避開底部區域 */}
      <div style={styles.chatCorner}>
        <ChatBox />
      </div>

      {/* 右下角 HUD（購物袋/登入等） */}
      <HUD onOpenCart={() => setCartOpen(true)} />

      {/* 便便按鈕（右下；不蓋住 HUD） */}
      <button style={styles.plantBtn} onClick={handlePlantNearMe} title="播一顆臨時便便（10分鐘）">
        便便 💩
      </button>

      {/* 彈幕/公告：統一放在頂部安全區，不與主面板重疊 */}
      <div style={styles.toastStack}>
        <div style={styles.toastItem}>
          <AnnouncementDanmaku lanes={4} rowHeight={38} topOffset={0} durationSec={9} />
        </div>
      </div>

      {/* 攤位選單 / 購物袋 / 管理商品 */}
      {openSheet && (
        <OrderSheetModal
          open={!!openSheet}
          stallId={openSheet}
          onClose={() => setOpenSheet(null)}
        />
      )}
      {cartOpen && <CartModal onClose={() => setCartOpen(false)} />}
      {pmOpen && <ProductManager onClose={() => setPmOpen(false)} />}

      <LoginGate />
    </div>
  );
}
