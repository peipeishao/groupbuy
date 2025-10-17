// src/features/pet/PetFollowers.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref as dbRef } from "firebase/database";
import { db } from "../../firebase";

/**
 * 簡單的便便寵物跟隨層（單隻）
 * - 訂閱所有玩家公開資料（x,y,dir,uid）
 * - 訂閱所有玩家的 pet（poopId,name）來決定誰該顯示寵物
 * - 使用每位玩家的 trail 製造延遲跟隨（lerp）
 * - 以絕對定位 div/emoji 顯示（不用改 Canvas）
 */
export default function PetFollowers() {
  // players: uid -> { x, y, dir, uid }
  const [players, setPlayers] = useState({});
  // pets: uid -> { poopId, name }
  const [pets, setPets] = useState({});

  // 訂閱所有玩家公開資料
  useEffect(() => {
    const off = onValue(dbRef(db, "playersPublic"), (snap) => {
      const val = snap.val() || {};
      // 只抽取必要欄位（避免過多 re-render）
      const pick = {};
      for (const uid in val) {
        const p = val[uid] || {};
        if (typeof p.x === "number" && typeof p.y === "number") {
          pick[uid] = { x: p.x, y: p.y, dir: p.dir || "down", uid };
        }
      }
      setPlayers(pick);
    });
    return () => off();
  }, []);

  // 訂閱所有玩家的 pet（公開指標）
  useEffect(() => {
    const off = onValue(dbRef(db, "playersPublic"), (snap) => {
      const val = snap.val() || {};
      const result = {};
      for (const uid in val) {
        const pet = val[uid]?.pet;
        if (pet && pet.poopId) {
          result[uid] = { poopId: pet.poopId, name: pet.name || "" };
        }
      }
      setPets(result);
    });
    return () => off();
  }, []);

  // 每位玩家的 trail 與寵物當前位置（不進 state，避免大量重繪）
  const trailsRef = useRef(new Map()); // uid -> { trail: [{x,y},...], pet:{x,y} }
  const [, force] = useState(0);

  // 動畫循環：更新跟隨位置
  useEffect(() => {
    let rafId;
    const LERP = 0.25;
    const DELAY = 10; // 追在主人 10 幀後
    const MAX_TRAIL = 40;

    const tick = () => {
      // push 當前玩家位置到 trail
      for (const uid in players) {
        const pl = players[uid];
        const rec = trailsRef.current.get(uid) || { trail: [], pet: { x: pl.x, y: pl.y } };
        rec.trail.unshift({ x: pl.x, y: pl.y });
        if (rec.trail.length > MAX_TRAIL) rec.trail.pop();

        // 若該玩家有寵物，計算目標點
        if (pets[uid]) {
          const targetIdx = Math.min(DELAY, rec.trail.length - 1);
          const target = rec.trail[targetIdx] || { x: pl.x, y: pl.y };
          rec.pet.x += (target.x - rec.pet.x) * LERP;
          rec.pet.y += (target.y - rec.pet.y) * LERP;
        }
        trailsRef.current.set(uid, rec);
      }

      // 清理 trail（玩家離線）
      for (const uid of Array.from(trailsRef.current.keys())) {
        if (!players[uid]) trailsRef.current.delete(uid);
      }

      // 觸發重繪
      force((n) => (n + 1) % 1000000);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [players, pets]);

  const items = useMemo(() => {
    const list = [];
    for (const uid in pets) {
      const rec = trailsRef.current.get(uid);
      const pl = players[uid];
      if (!rec || !pl) continue;

      const pt = rec.pet || { x: pl.x, y: pl.y };
      list.push({
        uid,
        x: Math.round(pt.x),
        y: Math.round(pt.y) + 10, // 微調高度
        name: pets[uid].name || "",
      });
    }
    return list;
  }, [players, pets]); // force() 每幀會促使此 memo 重新計算

  return (
    <>
      {items.map((it) => (
        <div
          key={it.uid}
          style={{
            position: "fixed",
            left: it.x,
            top: it.y,
            transform: "translate(-12px, -16px)",
            pointerEvents: "none",
            zIndex: 5,
            textAlign: "center",
            filter: "drop-shadow(0 2px 2px rgba(0,0,0,.35))",
          }}
        >
          <div style={{ fontSize: 22, lineHeight: 1 }}>💩</div>
          {it.name ? (
            <div
              style={{
                marginTop: 2,
                fontSize: 10,
                fontWeight: 800,
                background: "rgba(255,255,255,.85)",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "1px 4px",
                whiteSpace: "nowrap",
              }}
            >
              {it.name}
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
}
