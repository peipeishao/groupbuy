// src/town/MarketTown.jsx
import React, { useState, useEffect } from "react";
import Town from "./Town.jsx";
import OrdersSummaryTable from "../components/OrdersSummaryTable.jsx";
import OrderSheetModal from "../components/OrderSheetModal.jsx";
import CartModal from "../components/CartModal.jsx";
import ChatBox from "../components/ChatBox.jsx";
import HUD from "../components/HUD.jsx";
import LoginGate from "../components/LoginGate.jsx";
import ProductManager from "../components/ProductManager.jsx";
import FullBleedStage, {
  Pin,
  PlacardImageButton,
} from "../components/FullBleedStage.jsx";
import AnnouncementDanmaku from "../components/AnnouncementDanmaku.jsx";
import { announce } from "../utils/announce.js";
import { auth, db } from "../firebase.js";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import StallStatusSign from "../components/StallStatusSign.jsx";
import PetFollowers from "../features/pet/PetFollowers.jsx";
import TownHeader from "../components/TownHeader.jsx";

import {
  ensurePlayerPrivate,
  watchCommunityPoops,
  plantUserPoop,
  distance,
} from "./petSystem";

import { ref as dbRef, onValue } from "firebase/database";
import { adoptSpawnAsPet } from "../features/pet/petPublicApi";

const DOCK_H = 120;

const styles = {
  // 原本 panelArea 不再放在中間了，可以不使用
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
  // ⭐ 新增：底部抽屜（按鈕 + 展開的 OrdersSummaryTable）
  bottomDrawer: {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "20px",
    zIndex: 18,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
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
  toastItem: {
    pointerEvents: "auto",
  },
  chatCorner: {
    position: "fixed",
    left: "max(12px, env(safe-area-inset-left))",
    bottom: `calc(${DOCK_H}px + max(12px, env(safe-area-inset-bottom)) - 120px)`,
    zIndex: 15,
  },
  card: {
    width: "min(1050px, 96vw)",
    maxHeight: "60vh", // 避免展開太高
    borderRadius: 14,
    border: "1px solid #eee",
    boxShadow: "0 18px 36px rgba(0,0,0,.2)",
    background: "#fff",
    padding: 8,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  hScroll: {
    width: "100%",
    overflowX: "auto",
    overflowY: "auto",
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

  // 控制底部抽屜是否展開
  const [showOrdersTable, setShowOrdersTable] = useState(false);

  const [myPos, setMyPos] = useState(null);
  const [myPet, setMyPet] = useState(null);

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

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const off = onValue(dbRef(db, `playersPublic/${uid}/pet`), (snap) => {
      setMyPet(snap.val() || null);
    });
    return () => off();
  }, [auth.currentUser?.uid]);

  const BG_URL = "/bg-town-2.png";

  const placards = [
    {
      id: "chicken",
      label: "金豐盛雞胸肉",
      xPct: 47.0,
      yPct: 12.0,
      widthRel: 0.1,
    },
    {
      id: "cannele",
      label: "C文可麗露",
      xPct: 65.0,
      yPct: 12.0,
      widthRel: 0.14,
    },
  ];

  useEffect(() => {
    let unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          await signInAnonymously(auth);
          return;
        }
        await ensurePlayerPrivate();
        announce("歡迎旅人進入小鎮");
        unsub && unsub();
      } catch (e) {
        console.warn("[MarketTown] welcome/init failed:", e);
        unsub && unsub();
      }
    });
    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, []);

  const [communityPoops, setCommunityPoops] = useState([]);
  useEffect(() => {
    const off = watchCommunityPoops(setCommunityPoops);
    return () => off();
  }, []);

  useEffect(() => {
    if (!myPos) return;
    let cooling = false;
    const PICK_RADIUS = 56;

    const t = setInterval(async () => {
      if (cooling) return;
      const meUid = auth.currentUser?.uid;
      if (!meUid) return;

      if (myPet && myPet.poopId) return;

      for (const p of communityPoops) {
        if (p.uid === meUid) continue;
        if (distance(myPos, p) <= PICK_RADIUS) {
          cooling = true;
          try {
            const res = await adoptSpawnAsPet({
              meUid,
              spawn: {
                uid: p.uid,
                x: p.x,
                y: p.y,
                createdAt: p.createdAt ?? Date.now(),
              },
            });
            if (res?.ok || res?.reason === "already_has_pet") {
              // 可加 toast
            }
          } catch (e) {
            console.warn("[adoptSpawnAsPet] failed:", e);
          } finally {
            setTimeout(() => {
              cooling = false;
            }, 600);
          }
          break;
        }
      }
    }, 300);

    return () => clearInterval(t);
  }, [myPos, communityPoops, myPet]);

  async function handlePlantNearMe() {
    const myUid = auth.currentUser?.uid;
    const mine = communityPoops.filter((p) => p.uid === myUid);
    if (mine.length >= 2) {
      alert("你已經種了 2 顆便便，等它們過期再種吧！");
      return;
    }
    const base = myPos || { x: 960, y: 540 };
    const jitter = () => Math.random() * 60 - 30;
    await plantUserPoop({
      x: base.x + jitter(),
      y: base.y + jitter(),
    });
  }

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      {/* 上方預留區域給 Header */}
      <div style={{ height: "100px" }}></div>

      <FullBleedStage bg={BG_URL} baseWidth={1920} baseHeight={1080}>
        {/* 攤位狀態牌：金豐盛 */}
        <Pin xPct={47} yPct={24} widthRel={0.1}>
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

        {/* 攤位狀態牌：可麗露 */}
        <Pin xPct={65} yPct={24} widthRel={0.1}>
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

        {/* 攤位入口木牌 */}
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

        {/* 社群便便 */}
        {communityPoops.map((p) => (
          <div
            key={`${p.uid}:${p.id}`}
            style={{ position: "absolute", left: p.x, top: p.y }}
          >
            <div style={styles.poopIcon}>💩</div>
          </div>
        ))}
      </FullBleedStage>

      <PetFollowers />

      {/* 小鎮場景 & 玩家 */}
      <div style={{ position: "relative", zIndex: 3 }}>
        <Town />
      </div>

      {/* ⭐ 底部抽屜：按鈕在畫面正下方，展開時往上長出表格 */}
      <div style={styles.bottomDrawer}>
        {showOrdersTable && (
          <div style={styles.card}>
            <div
              style={{
                fontWeight: 800,
                marginBottom: 6,
              }}
            >
              訂單總表
            </div>
            <div style={styles.hScroll}>
              <OrdersSummaryTable fixedWidth="1000px" fixedHeight="500px" />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowOrdersTable((v) => !v)}
          style={{
            width: "min(1050px, 96vw)", // 很長的一顆按鈕
            padding: "10px 16px",
            borderRadius: 999,
            border: "2px solid #97311ee0",
            background: "#ffcaa4ff",
            color: "#fff",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: "0.04em",
            cursor: "pointer",
            boxShadow: "0 10px 24px rgba(124, 34, 7, 0.25)",
          }}
        >
          {showOrdersTable ? "收合訂單總表 ▲" : "展開訂單總表 ▼"}
        </button>
      </div>

      {/* 左下角聊天框 */}
      <div style={styles.chatCorner}>
        <ChatBox />
      </div>

      {/* 右下角 HUD（購物袋等） */}
      <HUD onOpenCart={() => setCartOpen(true)} />

      {/* 播便便按鈕 */}
      <button
        style={styles.plantBtn}
        onClick={handlePlantNearMe}
        title="播一顆臨時便便（10分鐘）"
      >
        便便 💩
      </button>

      {/* 公告彈幕 */}
      <div style={styles.toastStack}>
        <div style={styles.toastItem}>
          <AnnouncementDanmaku lanes={4} rowHeight={38} topOffset={0} durationSec={9} />
        </div>
      </div>

      {/* 攤位訂單小抄 */}
      {openSheet && (
        <OrderSheetModal
          open={!!openSheet}
          stallId={openSheet}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {/* 購物袋 */}
      {cartOpen && <CartModal onClose={() => setCartOpen(false)} />}

      {/* 商品管理 */}
      {pmOpen && <ProductManager onClose={() => setPmOpen(false)} />}

      {/* 登入門 */}
      <LoginGate />
    </div>
  );
}
