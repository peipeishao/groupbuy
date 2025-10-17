// src/features/pet/PetWindow.jsx
import React, { useEffect, useState } from "react";
import { onValue, ref as dbRef } from "firebase/database";
import { db } from "../../firebase";
import { renamePublicPet, dropPublicPet } from "./petPublicApi";

/** props: open, onClose, meUid */
export default function PetWindow({ open, onClose, meUid }) {
  const [pet, setPet] = useState(null);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!meUid || !open) return;
    const ref = dbRef(db, `playersPublic/${meUid}/pet`);
    const off = onValue(ref, (snap) => {
      const val = snap.val();
      setPet(val || null);
      setName(val?.name || "");
    });
    return () => off();
  }, [meUid, open]);

  if (!open) return null;

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <header style={header}>
          <h3 style={{ margin: 0 }}>寵物系統</h3>
          <button onClick={onClose} style={xbtn}>✕</button>
        </header>

        {!pet ? (
          <EmptyState />
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src="/assets/poop-pet.png" alt="pet" width={48} height={48} />
              <div>
                <div style={{ fontSize: 14, opacity: .7 }}>我的便便寵物</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{pet.name}</div>
                <div style={{ fontSize: 12, opacity: .6 }}>Poop ID：{pet.poopId}</div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>幫便便取名字</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：小金塊" style={input} />
                <button onClick={() => renamePublicPet({ meUid, name })} style={primary}>儲存</button>
              </div>
            </div>

            <hr style={hr} />

            <button onClick={() => dropPublicPet({ meUid })} style={danger}>
              丟掉便便（放回地上）
            </button>
          </div>
        )}

        <footer style={{ marginTop: 18, fontSize: 12, opacity: .7 }}>
          提示：一次只能擁有 1 隻便便寵物。靠近地上的便便可直接撿起（若你已在地圖事件中呼叫 adoptSpawnAsPet）。
        </footer>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 14, opacity: .85, marginBottom: 8 }}>目前沒有寵物。</div>
      <div style={{ fontSize: 13, opacity: .7 }}>到地圖上靠近一坨「別人拉的便便」即可撿起～</div>
    </div>
  );
}

// --- styles ---
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 1200, padding: 10 };
const panel = { width: 420, maxWidth: "95vw", background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 10px 30px rgba(0,0,0,.2)" };
const header = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 };
const xbtn = { border: "none", background: "transparent", fontSize: 18, cursor: "pointer" };
const input = { flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" };
const primary = { padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "#2563EB", color: "#fff" };
const danger = { padding: "10px 12px", borderRadius: 8, border: "1px solid #ef4444", color: "#ef4444", background: "transparent", cursor: "pointer" };
const hr = { border: 0, borderTop: "1px solid #eee", margin: "16px 0" };
