import React, { useState, useEffect } from "react";
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
import PetFollowers from "../features/pet/PetFollowers.jsx";
import TownHeader from "../components/TownHeader.jsx";

//
// 🐾 寵物系統（新版撿取 API）
// - 保留你原本的播種/監聽（watchCommunityPoops, plantUserPoop）
// - 將「靠近就撿」改為 adoptSpawnAsPet（建立 /poops 並寫入 playersPublic/{uid}/pet）
//
import {
  ensurePlayerPrivate,
  watchCommunityPoops,
  plantUserPoop,
  distance, // 仍沿用你的距離工具
} from "./petSystem";

import { ref as dbRef, onValue } from "firebase/database";

// ✅ 新增：採用我們第三步建立的 API
import { adoptSpawnAsPet } from "../features/pet/petPublicApi";

const DOCK_H = 120; // 預留右下 HUD/底部元件高度
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

  // 我的位置（由 playersPublic/{uid} 同步）
  const [myPos, setMyPos] = useState(null);
  // ✅ 我是否已經有便便寵物（來自 playersPublic/{uid}/pet）
  const [myPet, setMyPet] = useState(null);

  // 監聽自己的公開位置
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

  // ✅ 監聽自己的公開寵物指標（判斷是否已擁有寵物 → 有的話就不再撿）
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const off = onValue(dbRef(db, `playersPublic/${uid}/pet`), (snap) => {
      setMyPet(snap.val() || null);
    });
    return () => off();
  }, [auth.currentUser?.uid]);

  const BG_URL = "/bg-town-2.png";

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
        announce("歡迎旅人進入小鎮");
        unsub && unsub();
      } catch (e) {
        console.warn("[MarketTown] welcome/init failed:", e);
        unsub && unsub();
      }
    });
    return () => { try { unsub && unsub(); } catch {} };
  }, []);

  // 監聽所有人的「臨時便便」播種（仍沿用你的工具）
  const [communityPoops, setCommunityPoops] = useState([]); // [{uid,id,x,y,expiresAt, createdAt?}]
  useEffect(() => {
    const off = watchCommunityPoops(setCommunityPoops);
    return () => off();
  }, []);

  // ✅ 靠近任一顆「別人」的便便就嘗試認養成寵物（每人僅限 1 隻）
  //    用 interval 做輕量檢查；加上冷卻避免重複打 API
  useEffect(() => {
    if (!myPos) return;
    let cooling = false;
    const PICK_RADIUS = 56;
    const t = setInterval(async () => {
      if (cooling) return;
      const meUid = auth.currentUser?.uid;
      if (!meUid) return;

      // 已有寵物就不撿
      if (myPet && myPet.poopId) return;

      for (const p of communityPoops) {
        // 不能撿自己拉的（前端先擋；規則端也會擋）
        if (p.uid === meUid) continue;

        if (distance(myPos, p) <= PICK_RADIUS) {
          cooling = true;
          try {
            const res = await adoptSpawnAsPet({
              meUid,
              spawn: { uid: p.uid, x: p.x, y: p.y, createdAt: p.createdAt ?? Date.now() }
            });
            // 只有成功或「已擁有」才進入短冷卻，避免抖動
            if (res?.ok || res?.reason === "already_has_pet") {
              // 可加 toast 提示
            }
          } catch (e) {
            console.warn("[adoptSpawnAsPet] failed:", e);
          } finally {
            setTimeout(() => { cooling = false; }, 600);
          }
          break;
        }
      }
    }, 300);
    return () => clearInterval(t);
  }, [myPos, communityPoops, myPet]);

  // 在玩家附近播種一顆臨時便便（沿用你現有兩顆上限的策略）
  async function handlePlantNearMe() {
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
    <div style={{ minHeight: "100vh", position: "relative" }}>

     

      {/* 🚨 重要：推動畫面避免 TownHeader 被蓋住 or 擠到外面 */}
      <div style={{ height: "100px" }}></div>

      {/* 背景與釘點（兩塊開團時間牌 + 兩顆入口按鈕） */}
      {/* ↓↓↓ 下面開始完全保留你的原始程式碼 ↓↓↓ */}

      <FullBleedStage bg={BG_URL} baseWidth={1920} baseHeight={1080}>
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

        {communityPoops.map((p) => (
          <div key={`${p.uid}:${p.id}`} style={{ position: "absolute", left: p.x, top: p.y }}>
            <div style={styles.poopIcon}>💩</div>
          </div>
        ))}
      </FullBleedStage>

      <PetFollowers />

      <div style={{ position: "relative", zIndex: 3 }}>
        <Town />
      </div>

      <div style={styles.panelArea}>
        <div style={styles.card}>
          <div style={styles.hScroll}>
            <OrdersSummaryTable fixedWidth="1000px" fixedHeight="400px" />
          </div>
        </div>
      </div>

      <div style={styles.chatCorner}>
        <ChatBox />
      </div>

      <HUD onOpenCart={() => setCartOpen(true)} />

      <button style={styles.plantBtn} onClick={handlePlantNearMe} title="播一顆臨時便便（10分鐘）">
        便便 💩
      </button>

      <div style={styles.toastStack}>
        <div style={styles.toastItem}>
          <AnnouncementDanmaku lanes={4} rowHeight={38} topOffset={0} durationSec={9} />
        </div>
      </div>

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