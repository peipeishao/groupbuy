// src/features/pet/petPublicApi.js
import { db } from "../../firebase";
import { ref as dbRef, get, set, push, runTransaction, update } from "firebase/database";

/**
 * 從地上的便便（spawn）建立一筆持久化 /poops，並認養成自己的寵物
 * spawn 需要：{ uid, x, y, createdAt }  （你的 spawn 結構若多/少欄位不影響）
 */
export async function adoptSpawnAsPet({ meUid, spawn }) {
  if (!meUid || !spawn) return { ok: false, reason: "bad_args" };

  // 前端先擋：不能撿自己拉的（避免 console 噴 permission_denied）
  if (spawn.uid === meUid) return { ok: false, reason: "self_spawn" };

  // 若我已有公開寵物就不撿（每人上限 1 隻）
  const myPetSnap = await get(dbRef(db, `playersPublic/${meUid}/pet`));
  if (myPetSnap.exists() && myPetSnap.val()?.poopId) {
    return { ok: false, reason: "already_has_pet" };
  }

  // 建立 /poops/{poopId}
  const newRef = push(dbRef(db, "poops"));
  const poopId = newRef.key;
  await set(newRef, {
    x: spawn.x,
    y: spawn.y,
    author: spawn.uid,                 // 規則會用到
    owner: null,                       // 一開始沒主人
    createdAt: spawn.createdAt ?? Date.now(),
    adoptedAt: null
  });

  // 用 transaction 把 owner 從 null 搶成自己（避免同時撿）
  const ownerRef = dbRef(db, `poops/${poopId}/owner`);
  const tx = await runTransaction(ownerRef, (owner) => (owner == null ? meUid : owner));
  if (!tx.committed || tx.snapshot.val() !== meUid) {
    return { ok: false, reason: "taken" };
  }

  // 寫入公開寵物指標（顯示名稱）
  const defaultName = "便便寶";
  await update(dbRef(db), {
    [`playersPublic/${meUid}/pet`]: { poopId, name: defaultName, adoptedAt: Date.now() },
    [`poops/${poopId}/adoptedAt`]: Date.now()
  });

  return { ok: true, poopId };
}

/** 改寵物名字（公開顯示用） */
export async function renamePublicPet({ meUid, name }) {
  if (!meUid) return;
  await update(dbRef(db, `playersPublic/${meUid}/pet`), { name: name ?? "" });
}

/** 丟掉寵物（把 owner 改回 null，並清除我的公開指標） */
export async function dropPublicPet({ meUid }) {
  if (!meUid) return { ok: false, reason: "bad_args" };
  const petSnap = await get(dbRef(db, `playersPublic/${meUid}/pet`));
  if (!petSnap.exists()) return { ok: true };

  const { poopId } = petSnap.val() || {};
  await update(dbRef(db), {
    [`playersPublic/${meUid}/pet`]: null,
    [`poops/${poopId}/owner`]: null,
    [`poops/${poopId}/adoptedAt`]: null
  });
  return { ok: true };
}
