// src/components/Wardrobe.jsx
import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";
import { usePlayer } from "../store/playerContext";

const FALLBACK = {
  outfit_kimono: {
    name: "花色浴衣",
    price: 80,
    preview:
      "https://images.unsplash.com/photo-1559717201-fbb671ff56de?q=80&w=800&auto=format&fit=crop",
  },
  outfit_baker: {
    name: "麵包師圍裙",
    price: 60,
    preview:
      "https://images.unsplash.com/photo-1494412685616-a5d310fbb07d?q=80&w=800&auto=format&fit=crop",
  },
};

export default function Wardrobe() {
  const [outfits, setOutfits] = useState({});
  const { profile, addOutfit, equipOutfit, deductCoins } = usePlayer();

  useEffect(() => {
    const r = ref(db, "cosmetics/outfits");
    const unsub = onValue(r, (snap) => {
      const data = snap.val() || {};
      setOutfits(Object.keys(data).length ? data : FALLBACK);
    });
    return () => unsub();
  }, []);

  const owned = profile.inventory || {};

  const buy = async (id, price) => {
    if (owned[id]) return alert("已擁有！");
    if ((profile.coins || 0) < price) return alert("金幣不足");
    await deductCoins(price);
    await addOutfit(id);
    alert("購入成功！");
  };

  const equip = async (id) => {
    if (!owned[id]) return alert("尚未擁有");
    await equipOutfit(id);
  };

  return (
    <div style={{ padding: 16 }}>
      <h3>衣櫥</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {Object.entries(outfits).map(([id, o]) => (
          <div
            key={id}
            style={{
              background: "#fff",
              border: "1px solid #eee",
              borderRadius: 16,
              padding: 12,
            }}
          >
            <img
              src={o.preview}
              alt={o.name}
              style={{
                width: "100%",
                height: 160,
                objectFit: "cover",
                borderRadius: 12,
                marginBottom: 8,
              }}
            />
            <div style={{ fontWeight: 600 }}>{o.name}</div>
            <div style={{ margin: "6px 0" }}>價格：🪙{o.price}</div>
            {!owned[id] ? (
              <button onClick={() => buy(id, o.price)}>購買</button>
            ) : (
              <button
                onClick={() => equip(id)}
                disabled={profile.equippedOutfit === id}
              >
                {profile.equippedOutfit === id ? "已穿著" : "穿上"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

