// src/pages/petSystem.js
// 依賴你的 firebase.js 匯出的 db / auth（注意路徑回到上一層）
import { db, auth } from "../firebase";
import {
  ref as dbRef,
  get as dbGet,
  set,
  update,
  runTransaction,
  push,
  child,
  onValue,
} from "firebase/database";

/** 取得目前使用者 uid（未登入回 null） */
export function currentUid() {
  return auth?.currentUser?.uid || null;
}

/** 第一次登入時，幫玩家建立最小的私有節點（不會覆蓋既有資料） */
export async function ensurePlayerPrivate() {
  const uid = currentUid();
  if (!uid) return null;

  const meRef = dbRef(db, `playersPrivate/${uid}`);
  const snap = await dbGet(meRef);
  if (!snap.exists()) {
    await set(meRef, { uid, updatedAt: Date.now() });
  }
  return uid;
}

/** 若玩家沒有寵物，替他放入預設（便便 Lv1），並建立背包骨架（可選） */
export async function ensureDefaultPetPoop() {
  const uid = currentUid();
  if (!uid) return false;

  const petRef = dbRef(db, `playersPrivate/${uid}/pet`);
  const petSnap = await dbGet(petRef);
  if (!petSnap.exists()) {
    await update(dbRef(db, `playersPrivate/${uid}`), {
      pet: {
        species: "poop",
        level: 1,
        xp: 0,
        hunger: 70,
        mood: 80,
        equipped: { skin: null, trail: null },
        updatedAt: Date.now(),
      },
      petInventory: {
        species_poop: true,
        poop_feed: 0,
      },
      updatedAt: Date.now(),
    });
  }
  return true;
}

/** 播種一顆「臨時便便」：10 分鐘自動過期。建議前端限制同時 ≤ 2 顆 */
export async function plantUserPoop({ x, y }) {
  const uid = currentUid();
  if (!uid) return false;
  const nowTs = Date.now();
  const expiresAt = nowTs + 10 * 60 * 1000; // 10 分鐘

  const spawnId = push(child(dbRef(db), `map/userPoopSpawns/${uid}`)).key;
  await set(dbRef(db, `map/userPoopSpawns/${uid}/${spawnId}`), {
    x, y,
    createdAt: nowTs,
    expiresAt,
  });
  return true;
}

/** 清除自己已過期的便便（可在地圖載入時或按鈕觸發呼叫） */
export async function cleanupMyExpiredPoops() {
  const uid = currentUid();
  if (!uid) return;
  const snap = await dbGet(dbRef(db, `map/userPoopSpawns/${uid}`));
  const nowTs = Date.now();
  const updates = {};
  const v = snap.val() || {};
  for (const [id, item] of Object.entries(v)) {
    if (!item || typeof item.expiresAt !== "number") continue;
    if (item.expiresAt < nowTs) {
      updates[`map/userPoopSpawns/${uid}/${id}`] = null;
    }
  }
  if (Object.keys(updates).length) {
    await update(dbRef(db), updates);
  }
}

/**
 * 撿起地圖上的一般便便 → 背包 poop_feed +1（不刪地圖點，由 expiresAt 自行過期）
 * spawnId 可用你前端渲染用的 id（例如 `${uid}:${id}` 或點的原 id）
 */
export async function pickupWildPoop(spawnId = "p1") {
  const uid = currentUid();
  if (!uid) return false;

  // 可選：留一筆撿取紀錄（方便做活動/統計）
  const pushId = push(child(dbRef(db), `claims/poopPickup/${spawnId}/${uid}`)).key;
  await set(dbRef(db, `claims/poopPickup/${spawnId}/${uid}/${pushId}`), {
    ts: Date.now(),
  });

  // 背包數量 +1（transaction 保證並發安全）
  await runTransaction(
    dbRef(db, `playersPrivate/${uid}/petInventory/poop_feed`),
    (v) => Number(v || 0) + 1
  );

  return true;
}

/** 餵便便寵物：消耗 1 個 poop_feed，並調整屬性（+hunger/+mood/+xp） */
export async function feedPoopPet() {
  const uid = currentUid();
  if (!uid) return false;

  // 先扣背包；沒貨則中止（transaction 回傳 undefined 代表 abort）
  const invRef = dbRef(db, `playersPrivate/${uid}/petInventory/poop_feed`);
  const res = await runTransaction(invRef, (v) => {
    const curr = Number(v || 0);
    if (curr <= 0) return; // abort
    return curr - 1;
  });
  if (!res.committed) return false;

  const base = `playersPrivate/${uid}/pet`;
  await Promise.all([
    runTransaction(dbRef(db, `${base}/hunger`), (v) =>
      Math.min(100, Number(v || 0) + 12)
    ),
    runTransaction(dbRef(db, `${base}/mood`), (v) =>
      Math.min(100, Number(v || 0) + 8)
    ),
    runTransaction(dbRef(db, `${base}/xp`), (v) => Number(v || 0) + 3),
    set(dbRef(db, `${base}/updatedAt`), Date.now()),
  ]);

  return true;
}

/** 小工具：計算兩點距離（用於前端判定是否靠近神社/掉落物） */
export function distance(a, b) {
  const dx = (a?.x || 0) - (b?.x || 0);
  const dy = (a?.y || 0) - (b?.y || 0);
  return Math.hypot(dx, dy);
}

/** 監聽所有使用者的播種（臨時便便） */
export function watchCommunityPoops(cb) {
  const ref = dbRef(db, "map/userPoopSpawns");
  const off = onValue(ref, (snap) => {
    const nowTs = Date.now();
    const list = [];
    const v = snap.val() || {};
    for (const [uid, seeds] of Object.entries(v)) {
      for (const [id, item] of Object.entries(seeds || {})) {
        if (item && item.expiresAt > nowTs) {
          list.push({ uid, id, ...item });
        }
      }
    }
    cb(list);
  });
  return () => off();
}
