// src/components/OrderSheetModal.jsx — 單一卷軸 + 加入購物車移到下方
import React, { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase.js";
import { ref, set, onValue } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";
import { useCart } from "../store/useCart.js";
import ReviewModal from "./reviews/ReviewModal.jsx";
import { ref as dbRef } from "firebase/database"; // for useReviewStats

const fmt = (n) => new Intl.NumberFormat("zh-TW").format(n || 0);
const fmt1 = (n) =>
  new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n || 0);

/** 訂閱某商品的評論統計（平均星等與評論數） */
function useReviewStats(itemId) {
  const [stats, setStats] = useState({ count: 0, avg: 0 });
  useEffect(() => {
    if (!itemId) return;
    const off = onValue(dbRef(db, `reviews/${itemId}`), (snap) => {
      const v = snap.val() || {};
      const arr = Object.values(v);
      const count = arr.length;
      const avg = count ? arr.reduce((s, r) => s + (Number(r.stars) || 0), 0) / count : 0;
      setStats({ count, avg });
    });
    return () => off();
  }, [itemId]);
  return stats;
}

/** 商品卡 */
function ProductCard({ p, q, onDec, onInc, onInput, onOpenReview }) {
  const stats = useReviewStats(p.id);
  return (
    <div className="card" style={{ padding: 10, borderRadius: 12, border: "1px solid #eee" }}>
      {p.img ? (
        <img
          src={p.img}
          alt={p.name}
          style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10, marginBottom: 6 }}
        />
      ) : (
        <div
          style={{
            height: 120,
            background: "#f1f5f9",
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            marginBottom: 6,
            color: "#64748b",
            fontSize: 12,
          }}
        >
          無圖片
        </div>
      )}

      <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {p.name}
      </div>

      {/* 價格列 */}
      <div style={{ margin: "6px 0" }}>
        價格：🪙 {fmt1(p.price)}
        {typeof p.original === "number" && p.original > p.price && (
          <span style={{ marginLeft: 6, color: "#64748b", textDecoration: "line-through" }}>{fmt(p.original)}</span>
        )}
        {p.unit && <span style={{ marginLeft: 6, color: "#64748b" }}>／{p.unit}</span>}
      </div>

      {/* ⭐ 評論摘要 + 入口 */}
      <div style={{ color: "#475569", fontSize: 12, marginBottom: 6 }}>
        <span title={`平均 ${stats.avg.toFixed(1)} 星`}>
          {"★".repeat(Math.round(stats.avg || 0)) || "☆"}{" "}
          <span style={{ color: "#94a3b8" }}>（{stats.count} 則評論）</span>
        </span>
        <button onClick={onOpenReview} style={linkBtn}>查看 / 撰寫評論</button>
      </div>

      {/* 數量控制（先在上半部選好，再到下方一次加入） */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onDec} className="small-btn">−</button>
        <input
          value={q}
          onChange={onInput}
          inputMode="numeric"
          pattern="[0-9]*"
          style={{ width: 48, textAlign: "center", border: "1px solid #ddd", borderRadius: 8, padding: "6px 4px" }}
        />
        <button type="button" onClick={onInc} className="small-btn">＋</button>
      </div>
    </div>
  );
}

export default function OrderSheetModal({ open, stallId, onClose }) {
  const { openLoginGate } = usePlayer();
  const { items: cartAll = [], reload } = useCart();

  // ❶ 可選商品（依序讀：stalls → products/{stallId} → products）
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceLabel, setSourceLabel] = useState("");

  // ❷ 本攤位的購物袋內容（直接訂閱 carts/{uid}/items）
  const [stallCart, setStallCart] = useState([]);
  useEffect(() => {
    if (!open || !stallId) { setStallCart([]); return; }
    if (!auth.currentUser) {
      setStallCart(cartAll.filter((it) => String(it.stallId) === String(stallId)));
      return;
    }
    const me = auth.currentUser.uid;
    const off = onValue(ref(db, `carts/${me}/items`), (snap) => {
      const v = snap.val() || {};
      const arr = Object.values(v).filter((it) => String(it.stallId) === String(stallId));
      setStallCart(arr);
    }, (err) => {
      console.warn("[OrderSheet] stallCart subscribe error:", err);
      setStallCart(cartAll.filter((it) => String(it.stallId) === String(stallId)));
    });
    return () => { try { off(); } catch {} };
  }, [open, stallId, cartAll]);

  const total = useMemo(
    () => stallCart.reduce((s, x) => s + (Number(x.price) || 0) * (Number(x.qty) || 0), 0),
    [stallCart]
  );

  // ❸ 上半部選擇用：每個商品的「待加入數量」
  const [sel, setSel] = useState({});
  const selTotalQty = useMemo(
    () => Object.values(sel).reduce((s, n) => s + (Number(n) || 0), 0),
    [sel]
  );
  const inc = (id, d) => setSel((m) => ({ ...m, [id]: Math.max(0, (Number(m[id]) || 0) + d) }));
  const setQty = (id, v) => setSel((m) => ({ ...m, [id]: Math.max(0, Number(v) || 0) }));

  // ✅ 評論視窗控制
  const [reviewItem, setReviewItem] = useState(null);

  // 讀取可選商品（三段 fallback）
  useEffect(() => {
    if (!open) return;
    let off1 = null, off2 = null, off3 = null;
    setLoading(true);
    setSourceLabel("");
    setSel({});

    const useProductsFlat = () => {
      if (off3) return;
      const r3 = ref(db, "products");
      off3 = onValue(
        r3,
        (snap) => {
          const v = snap.val();
          if (v && typeof v === "object") {
            const list = Object.entries(v).map(([id, p]) => {
              const price = p?.price != null ? Number(p.price) : p?.priceGroup != null ? Number(p.priceGroup) : 0;
              const original = p?.original != null ? Number(p.original) : p?.priceOriginal != null ? Number(p.priceOriginal) : undefined;
              return {
                id,
                name: String(p?.name ?? ""),
                price,
                original,
                img: String(p?.imageUrl ?? ""),
                unit: String(p?.unit ?? "包"),
                category: String(p?.category ?? ""),
                active: p?.active !== false,
                createdAt: Number(p?.createdAt ?? 0),
              };
            });
            const filtered = list
              .filter((it) => it.active && it.price > 0 && (!stallId || it.category === String(stallId)))
              .sort((a, b) => (b.createdAt - a.createdAt) || String(a.name).localeCompare(String(b.name)));
            setAvailable(filtered.map(({ active, createdAt, category, ...it }) => it));
            setSourceLabel("products");
          } else {
            setAvailable([]);
            setSourceLabel("none");
          }
          setLoading(false);
        },
        () => { setAvailable([]); setSourceLabel("none"); setLoading(false); }
      );
    };

    const useProductsByStall = () => {
      if (off2) return;
      const r2 = ref(db, `products/${stallId}`);
      off2 = onValue(
        r2,
        (snap) => {
          const v = snap.val();
          if (v && typeof v === "object") {
            const list = Object.entries(v)
              .map(([id, p]) => {
                const price = p?.priceGroup != null ? Number(p.priceGroup) : p?.price != null ? Number(p.price) : 0;
                const original = p?.priceOriginal != null ? Number(p.priceOriginal) : p?.original != null ? Number(p.original) : undefined;
                return {
                  id,
                  name: String(p?.name ?? ""),
                  price,
                  original,
                  img: String(p?.imageUrl ?? ""),
                  unit: String(p?.unit ?? "包"),
                  active: p?.active !== false,
                  createdAt: Number(p?.createdAt ?? 0),
                };
              })
              .filter((it) => it.active && it.price > 0)
              .sort((a, b) => (b.createdAt - a.createdAt) || String(a.name).localeCompare(String(b.name)));
            setAvailable(list.map(({ active, createdAt, ...it }) => it));
            setSourceLabel("products/{stallId}");
            setLoading(false);
          } else {
            useProductsFlat();
          }
        },
        () => useProductsFlat()
      );
    };

    const r1 = ref(db, `stalls/${stallId}/items`);
    off1 = onValue(
      r1,
      (snap) => {
        const v = snap.val();
        if (v && typeof v === "object") {
          const list = (Array.isArray(v) ? v.filter(Boolean) : Object.values(v))
            .map((it) => ({
              id: String(it.id ?? ""),
              name: String(it.name ?? ""),
              price: Number(it.price ?? 0),
              original: it.original != null ? Number(it.original) : undefined,
              img: String(it.img ?? ""),
              unit: String(it.unit ?? "包"),
            }))
            .filter((it) => it.price > 0);
          if (list.length > 0) {
            setAvailable(list);
            setSourceLabel("stalls");
            setLoading(false);
          } else {
            useProductsByStall();
          }
        } else {
          useProductsByStall();
        }
      },
      () => useProductsByStall()
    );

    return () => {
      off1 && off1();
      off2 && off2();
      off3 && off3();
    };
  }, [open, stallId]);

  // 把「上半部選好的數量」一次加入購物袋（改為在底部按鈕觸發）
  const addSelectedToCart = async () => {
    try {
      const me = auth.currentUser?.uid;
      if (!me) {
        openLoginGate?.({ mode: "upgrade" });
        return;
      }
      const tasks = [];
      const now = Date.now();

      for (const it of available) {
        const q = Number(sel[it.id]) || 0;
        if (q <= 0) continue;

        const key = `${stallId}|${it.id}`;
        const prev = stallCart.find((x) => x.stallId === stallId && x.id === it.id);
        const nextQty = (Number(prev?.qty) || 0) + q;

        tasks.push(
          set(ref(db, `carts/${me}/items/${key}`), {
            stallId,
            id: it.id,
            name: it.name,
            price: Number(it.price) || 0,
            qty: nextQty,
          })
        );
      }
      if (tasks.length === 0) return;

      tasks.push(set(ref(db, `carts/${me}/updatedAt`), now));
      await Promise.all(tasks);

      setSel({});
      await reload?.();
    } catch (e) {
      console.error("[addSelectedToCart] failed", e);
      alert("加入購物袋失敗，請稍後再試");
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(980px, 96vw)",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #eee",
          boxShadow: "0 20px 48px rgba(0,0,0,.2)",
          display: "grid",
          gridTemplateRows: "56px 1fr auto", // 標題 +（單一可滾動內容）+ 底部
          maxHeight: "88vh",
          overflow: "hidden",
        }}
      >
        {/* 標題列 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            borderBottom: "1px solid #eee",
            background: "#f9fafb",
          }}
        >
          <h3 style={{ margin: 0 }}>
            攤位：{stallId || "全部"}　|　購物清單
          </h3>
        </div>

        {/* 單一可滾動內容（包含 ❶ 與 ❷） */}
        <div style={{ overflow: "auto", minHeight: 0 }}>
          {/* ❶ 可選商品（移除原本上方的加入購物車按鈕） */}
          <section style={{ padding: 14, borderBottom: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, gap: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontWeight: 800 }}>可選商品</div>
                {sourceLabel && (
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    來源：<code>{sourceLabel}</code>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#475569" }}>
                已選 <b>{selTotalQty}</b> 件
              </div>
            </div>

            {loading ? (
              <div style={{ color: "#64748b", padding: 8 }}>載入中…</div>
            ) : available.length === 0 ? (
              <div style={{ color: "#64748b", padding: 8 }}>這個攤位目前沒有商品</div>
            ) : (
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))" }}>
                {available.map((p) => {
                  const q = Number(sel[p.id]) || 0;
                  return (
                    <ProductCard
                      key={p.id}
                      p={p}
                      q={q}
                      onDec={() => inc(p.id, -1)}
                      onInc={() => inc(p.id, +1)}
                      onInput={(e) => setQty(p.id, e.target.value)}
                      onOpenReview={() => setReviewItem({ id: p.id, name: p.name })}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* ❷ 已加入購物袋（以 stallCart 為準） */}
          <section style={{ padding: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#fafafa" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: 8 }}>品項</th>
                  <th style={{ textAlign: "right", padding: 8, width: 80 }}>單價</th>
                  <th style={{ textAlign: "right", padding: 8, width: 80 }}>數量</th>
                  <th style={{ textAlign: "right", padding: 8, width: 120 }}>小計</th>
                </tr>
              </thead>
              <tbody>
                {stallCart.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: 12, textAlign: "center", color: "#888" }}>
                      這個攤位的購物袋目前沒有品項
                    </td>
                  </tr>
                ) : (
                  stallCart.map((it) => {
                    const sub = (Number(it.price) || 0) * (Number(it.qty) || 0);
                    return (
                      <tr key={`${it.stallId}|${it.id}`} style={{ borderTop: "1px solid #f0f0f0" }}>
                        <td style={{ padding: 8 }}>{it.name}</td>
                        <td style={{ padding: 8, textAlign: "right" }}>{fmt1(it.price)}</td>
                        <td style={{ padding: 8, textAlign: "right" }}>{it.qty}</td>
                        <td style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>{fmt1(sub)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <div style={{ textAlign: "right", marginTop: 8, color: "#111", fontWeight: 800 }}>
              合計 NT$ {fmt1(total)}
            </div>
          </section>
        </div>

        {/* 底部動作列：加入購物車（在左）＋ 關閉（在右） */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 16px 16px" }}>
          <button
            onClick={addSelectedToCart}
            disabled={loading || selTotalQty <= 0}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "2px solid #111",
              background: "#fff",
              fontWeight: 800,
              cursor: selTotalQty > 0 ? "pointer" : "not-allowed",
            }}
            title={selTotalQty > 0 ? `加入 ${selTotalQty} 件到購物袋` : "請先在上方選擇數量"}
          >
            加入購物車
          </button>

          <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 12 }}>
            關閉
          </button>
        </div>
      </div>

      {/* ✅ 評論視窗 */}
      {reviewItem && (
        <ReviewModal open itemId={reviewItem.id} itemName={reviewItem.name} onClose={() => setReviewItem(null)} />
      )}
    </div>
  );
}

/* 小樣式 */
const linkBtn = { marginLeft: 10, border: "none", background: "transparent", color: "#2563eb", cursor: "pointer", textDecoration: "underline" };
