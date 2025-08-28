// src/components/StallGrid.jsx
import React, { useMemo, useState } from "react";
import StallCard from "./StallCard";
import { usePlayer } from "../store/playerContext";
import { db } from "../firebase";
import { ref, push, serverTimestamp } from "firebase/database";

const DEMO_STALLS = [
  {
    id: "bakery",
    title: "可愛點心攤",
    owner: "NPC_奶油兔",
    bannerUrl:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=1200&auto=format&fit=crop",
    items: [
      { id: "donut1", name: "草莓甜甜圈", price: 15, img: "https://images.unsplash.com/photo-1511910849309-0dffb374f9bb?q=80&w=800&auto=format&fit=crop", stock: 20 },
      { id: "cookie1", name: "巧克力餅乾", price: 10, img: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?q=80&w=800&auto=format&fit=crop", stock: 30 },
    ],
  },
  {
    id: "tea",
    title: "涼涼飲料攤",
    owner: "NPC_薄荷熊",
    bannerUrl:
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1200&auto=format&fit=crop",
    items: [
      { id: "tea1", name: "紅茶", price: 12, img: "https://images.unsplash.com/photo-1527169402691-feff5539e52c?q=80&w=800&auto=format&fit=crop", stock: 50 },
      { id: "tea2", name: "奶茶", price: 18, img: "https://images.unsplash.com/photo-1517705008128-361805f42e86?q=80&w=800&auto=format&fit=crop", stock: 40 },
    ],
  },
];

export default function StallGrid() {
  const stalls = useMemo(() => DEMO_STALLS, []);
  const [open, setOpen] = useState(null); // 開啟的攤位
  const [cart, setCart] = useState([]);   // {stallId, item, qty}
  const { uid, profile, deductCoins, addCoins, awardBadge } = usePlayer();

  const addToCart = (stallId, item) => {
    setCart((c) => {
      const i = c.findIndex((x) => x.item.id === item.id);
      if (i >= 0) {
        const next = [...c];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...c, { stallId, item, qty: 1 }];
    });
  };

  const total = cart.reduce((s, x) => s + x.item.price * x.qty, 0);

  const checkout = async () => {
    if (cart.length === 0) return;
    if ((profile.coins || 0) < total) {
      alert("金幣不足");
      return;
    }
    // 寫入 orders（每項一筆）
    for (const it of cart) {
      await push(ref(db, "orders"), {
        playerId: uid,
        stallId: it.stallId,
        itemId: it.item.id,
        qty: it.qty,
        total: it.item.price * it.qty,
        ts: serverTimestamp(),
      });
    }
    await deductCoins(total);
    setCart([]);

    // 首購獎勵
    if (!profile.badges?.firstBuy) {
      await addCoins(20);
      await awardBadge("firstBuy");
      alert("任務完成：第一次購買 +20 金幣！");
    } else {
      alert("付款成功！");
    }
  };

  return (
    <>
      {/* 攤位總覽 */}
      {!open && (
        <div
          style={{
            padding: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {stalls.map((s) => (
            <StallCard key={s.id} stall={s} onOpen={setOpen} />
          ))}
        </div>
      )}

      {/* 攤位內頁 */}
      {open && (
        <div style={{ padding: 16 }}>
          <button onClick={() => setOpen(null)} style={{ marginBottom: 12 }}>
            ← 返回市集
          </button>
          <h2 style={{ margin: "6px 0" }}>{open.title}</h2>
          <div style={{ color: "#666", marginBottom: 12 }}>攤主：{open.owner}</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {open.items.map((it) => (
              <div
                key={it.id}
                style={{
                  background: "#fff",
                  border: "1px solid #eee",
                  borderRadius: 16,
                  padding: 12,
                }}
              >
                <img
                  src={it.img}
                  alt={it.name}
                  style={{
                    width: "100%",
                    height: 140,
                    objectFit: "cover",
                    borderRadius: 12,
                    marginBottom: 8,
                  }}
                />
                <div style={{ fontWeight: 600 }}>{it.name}</div>
                <div style={{ margin: "6px 0" }}>價格：🪙 {it.price}</div>
                <button onClick={() => addToCart(open.id, it)}>加入購物袋</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 購物袋 */}
      <div
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 12,
          width: 280,
          boxShadow: "0 6px 18px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>🧺 購物袋</div>
        {cart.length === 0 ? (
          <div style={{ color: "#666" }}>還沒有商品</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cart.map((c) => (
              <div key={c.item.id} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>
                  {c.item.name} × {c.qty}
                </span>
                <span>🪙{c.item.price * c.qty}</span>
              </div>
            ))}
            <div style={{ marginTop: 6, fontWeight: 700 }}>合計：🪙 {total}</div>
            <button onClick={checkout}>付款</button>
          </div>
        )}
      </div>
    </>
  );
}
