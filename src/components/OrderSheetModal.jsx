// src/components/OrderSheetModal.jsx — 綁定 pricing.js（顯示折扣；其他流程維持）
import React, { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase.js";
import { ref, set, onValue, runTransaction } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";
import { useCart } from "../store/useCart.js";
import ReviewModal from "./reviews/ReviewModal.jsx";
import { ref as dbRef } from "firebase/database"; // for useReviewStats

// ⬇️ 價格工具（共用）
import { DISCOUNT, calcPriceBreakdown, ntd1 } from "../utils/pricing.js";

const fmt = (n) => new Intl.NumberFormat("zh-TW").format(n || 0);
const fmt1 = (n) => new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n || 0);

/** ===== 攤位 campaign 倒數（原樣保留） ===== */
function useStallCampaign(stallId) {
  const [camp, setCamp] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!stallId) return;
    const off = onValue(ref(db, `stalls/${stallId}/campaign`), (snap) => setCamp(snap.val() || null));
    const t = setInterval(() => setTick((x) => (x + 1) % 1e9), 1000);
    return () => { off && off(); clearInterval(t); };
  }, [stallId]);
  const now = Date.now();
  const startAt = camp?.startAt ? Number(camp.startAt) : null;
  const closeAt = camp?.closeAt ? Number(camp.closeAt) : null;
  const statusRaw = String(camp?.status || "ongoing");
  const upcoming = startAt && now < startAt;
  const ended = (closeAt && now >= closeAt) || statusRaw === "ended";
  const cdText = (() => {
    if (!closeAt) return "-";
    if (ended) return "已截止";
    const s = Math.floor((closeAt - now) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}` : `${m}:${String(sec).padStart(2,"0")}`;
  })();
  return { upcoming, ended, cdText };
}

function CountdownBadgeInline({ upcoming, ended, cdText }) {
  let bg = "#22c55e";
  if (cdText !== "-" && !ended) {
    const parts = cdText.split(":").map(Number);
    const totalMin = parts.length === 3 ? parts[0] * 60 + parts[1] : parts[0];
    if (totalMin <= 120 && totalMin > 30) bg = "#f59e0b";
    if (totalMin <= 30) bg = "#ef4444";
  }
  if (upcoming) bg = "#3b82f6";
  if (ended) bg = "#9ca3af";
  const label = upcoming ? "尚未開始" : ended ? "已截止" : `倒數 ${cdText}`;
  return (
    <span style={{ background: bg, color: "#fff", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 800, display: "inline-flex", gap: 6, alignItems: "center" }}>
      <span role="img" aria-label="timer">⏰</span>{label}
    </span>
  );
}

/** 評論統計（原樣保留） */
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

/** ⭐ 預留庫存（避免賣超） */
async function setReservation(productId, targetQty, capacity) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("尚未登入");
  const cap = Number(capacity || 0);
  if (!cap) {
    await set(ref(db, `stock/${productId}/reservations/${uid}`), Math.max(0, Number(targetQty || 0)));
    return Math.max(0, Number(targetQty || 0));
  }
  const nodeRef = ref(db, `stock/${productId}`);
  const tx = await runTransaction(nodeRef, (data) => {
    const n = data || {};
    if (!n.reservations) n.reservations = {};
    const sold = Number(n.soldCount || 0);
    let others = 0;
    for (const k in n.reservations) if (k !== uid) others += Number(n.reservations[k] || 0);
    const maxAllow = Math.max(0, cap - sold - others);
    n.reservations[uid] = Math.max(0, Math.min(Number(targetQty || 0), maxAllow));
    return n;
  });
  if (!tx.committed) throw new Error("預留失敗，請重試");
  const snap = tx.snapshot.val() || {};
  return Number(snap?.reservations?.[uid] || 0);
}

/** 商品卡（原外觀保留；下方僅控制數量） */
function ProductCard({ p, q, onDec, onInc, onInput, onOpenReview }) {
  const stats = useReviewStats(p.id);
  return (
    <div className="card" style={{ padding: 10, borderRadius: 12, border: "1px solid #eee" }}>
      {p.img ? (
        <img src={p.img} alt={p.name} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10, marginBottom: 6 }} />
      ) : (
        <div style={{ height: 120, background: "#f1f5f9", borderRadius: 10, display: "grid", placeItems: "center", marginBottom: 6, color: "#64748b", fontSize: 12 }}>
          無圖片
        </div>
      )}

      <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>

      <div style={{ margin: "6px 0" }}>
        價格：🪙 {fmt1(p.price)}
        {typeof p.original === "number" && p.original > p.price && (
          <span style={{ marginLeft: 6, color: "#64748b", textDecoration: "line-through" }}>{fmt(p.original)}</span>
        )}
        {p.unit && <span style={{ marginLeft: 6, color: "#64748b" }}>／{p.unit}</span>}
      </div>

      <div style={{ color:"#64748b", fontSize:12, marginBottom:4 }}>最低下單 {p.minQty}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onDec} className="small-btn">−</button>
        <input
          value={q}
          onChange={onInput}
          inputMode="numeric"
          pattern="[0-9]*"
          step={1}
          min={0}
          style={{ width: 60, textAlign: "center", border: "1px solid #ddd", borderRadius: 8, padding: "6px 4px" }}
        />
        <button type="button" onClick={onInc} className="small-btn">＋</button>
      </div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onOpenReview} style={linkBtn}>查看 / 撰寫評論</button>
        <div title={`平均 ${stats.avg.toFixed(1)}★ / 共 ${stats.count} 則`} style={badgeStyle}>
          <span style={{ fontWeight: 900 }}>★ {stats.avg.toFixed(1)}</span>
          <span style={{ opacity: .8 }}>（{stats.count}）</span>
        </div>
      </div>
    </div>
  );
}

export default function OrderSheetModal({ open, stallId, onClose }) {
  const { openLoginGate } = usePlayer();
  const { items: cartAll = [], reload } = useCart();

  const { upcoming, ended, cdText } = useStallCampaign(stallId);

  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceLabel, setSourceLabel] = useState("");

  // 本攤位購物袋（原樣保留）
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
    }, () => {
      setStallCart(cartAll.filter((it) => String(it.stallId) === String(stallId)));
    });
    return () => { try { off(); } catch {} };
  }, [open, stallId, cartAll]);

  const total = useMemo(
    () => stallCart.reduce((s, x) => s + (Number(x.price) || 0) * (Number(x.qty) || 0), 0),
    [stallCart]
  );

  // 折扣顯示（僅 UI）
  const { discount: discountAmt, totalAfterDiscount, label: DISCOUNT_LABEL } =
    useMemo(() => calcPriceBreakdown(stallCart, DISCOUNT), [stallCart]);

  // 上半部：每個商品的「待加入數量」
  const [sel, setSel] = useState({});
  const selTotalQty = useMemo(() => Object.values(sel).reduce((s, n) => s + (Number(n) || 0), 0), [sel]);
  const setQty = (id, v) => setSel((m) => ({ ...m, [id]: Math.max(0, Number(v) || 0) }));

  // 評論視窗控制
  const [reviewItem, setReviewItem] = useState(null);

  // 讀取可選商品（fallback：stalls/{stallId}/items → products/{stallId} → products）
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
                stallId: String(p?.stallId ?? ""),
                category: String(p?.category ?? ""),
                active: p?.active !== false,
                createdAt: Number(p?.createdAt ?? 0),
                minQty: Math.max(1, Number(p?.minQty || 1)),
                stockCapacity: Number(p?.stockCapacity || 0),
              };
            });
            const filtered = list
              .filter((it) => it.active && it.price > 0 && (!stallId || String(it.stallId || it.category) === String(stallId)))
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
                  minQty: Math.max(1, Number(p?.minQty || 1)),
                  stockCapacity: Number(p?.stockCapacity || 0),
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
              // 此結構通常沒有 minQty/stockCapacity，給預設
              minQty: 1,
              stockCapacity: 0,
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

    return () => { off1 && off1(); off2 && off2(); off3 && off3(); };
  }, [open, stallId]);

  /** 加入購物袋：以「本次目標量」覆寫（不累加），並預留庫存 */
  const addSelectedToCart = async () => {
    try {
      const { upcoming, ended } = useStallCampaign(stallId);
      if (ended || upcoming) {
        alert(upcoming ? "此攤尚未開始，暫時無法加入。" : "此攤已截止，無法加入。");
        return;
      }
      const me = auth.currentUser?.uid;
      if (!me) {
        openLoginGate?.({ mode: "upgrade" });
        return;
      }
      const now = Date.now();

      for (const it of available) {
        const chosen = Number(sel[it.id]) || 0;
        if (chosen <= 0) continue;

        const minQty = Math.max(1, Number(it.minQty || 1));
        let targetQty = Math.max(0, Math.floor(chosen));
        if (targetQty > 0 && targetQty < minQty) targetQty = minQty;

        const finalReserved = await setReservation(it.id, targetQty, it.stockCapacity);

        if (finalReserved > 0 && finalReserved < Math.min(targetQty, minQty)) {
          alert(`「${it.name}」剩餘不足最低下單量 ${minQty}，目前可預留：${finalReserved}`);
          if (finalReserved < minQty) continue;
        }

        const key = `${stallId}|${it.id}`;
        if (finalReserved <= 0) {
          await set(ref(db, `carts/${me}/items/${key}`), null);
        } else {
          await set(ref(db, `carts/${me}/items/${key}`), {
            stallId,
            id: it.id,
            name: it.name,
            price: Number(it.price) || 0,
            qty: finalReserved,
          });
        }
      }

      await set(ref(db, `carts/${me}/updatedAt`), now);
      setSel({});
      await reload?.();
    } catch (e) {
      console.error("[addSelectedToCart] failed", e);
      alert("加入購物袋失敗，請稍後再試");
    }
  };

  if (!open) return null;

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000, display: "grid", placeItems: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(980px, 96vw)", background: "#fff", borderRadius: 16, border: "1px solid #eee", boxShadow: "0 20px 48px rgba(0,0,0,.2)", display: "grid", gridTemplateRows: "56px 1fr auto", maxHeight: "88vh", overflow: "hidden" }}>
        {/* 標題列 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "1px solid #eee", background: "#f9fafb" }}>
          <h3 style={{ margin: 0 }}>攤位：{stallId || "全部"}　|　購物清單</h3>
          <CountdownBadgeInline {...useStallCampaign(stallId)} />
        </div>

        {/* 單一可滾動內容 */}
        <div style={{ overflow: "auto", minHeight: 0 }}>
          {/* 可選商品 */}
          <section style={{ padding: 14, borderBottom: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, gap: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontWeight: 800 }}>可選商品</div>
                {sourceLabel && (<div style={{ fontSize: 12, color: "#64748b" }}>來源：<code>{sourceLabel}</code></div>)}
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
                  const productMinQty = Math.max(1, Number(p.minQty || 1));
                  const curQty = Number(sel[p.id] || 0);

                  return (
                    <ProductCard
                      key={p.id}
                      p={p}
                      q={q}
                      onDec={() => setSel((s) => ({ ...s, [p.id]: curQty <= productMinQty ? 0 : curQty - 1 }))}
                      onInc={() => setSel((s) => ({ ...s, [p.id]: curQty < productMinQty ? productMinQty : curQty + 1 }))}
                      onInput={(e) => {
                        const raw = Math.max(0, Math.floor(Number(e.target.value) || 0));
                        const next = raw > 0 && raw < productMinQty ? productMinQty : raw;
                        setSel((s) => ({ ...s, [p.id]: next }));
                      }}
                      onOpenReview={() => setReviewItem({ id: p.id, name: p.name })}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* 已加入購物袋 */}
          <section style={{ padding: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#fafafa" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: 8 }}>品項</th>
                  <th style={{ textAlign: "right", padding: 8, width: 80 }}>單價</th>
                  <th style={{ textAlign: "right", padding: 8, width: 80 }}>數量</th>
                  <th style={{ textAlign: "right", padding: 8, width: 110 }}>小計</th>
                </tr>
              </thead>
              <tbody>
                {stallCart.length === 0 ? (
                  <tr><td colSpan="4" style={{ padding: 12, textAlign: "center", color: "#888" }}>購物袋目前沒有品項</td></tr>
                ) : (
                  stallCart.map((it, i) => {
                    const sub = Number(it.price || 0) * Number(it.qty || 0);
                    return (
                      <tr key={i}>
                        <td style={{ padding: 8 }}>{it.name}</td>
                        <td style={{ padding: 8, textAlign: "right" }}>{fmt1(it.price || 0)}</td>
                        <td style={{ padding: 8, textAlign: "right" }}>{Number(it.qty || 0)}</td>
                        <td style={{ padding: 8, textAlign: "right" }}>{fmt1(sub)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* 折扣列（僅顯示，不寫 DB） */}
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>{DISCOUNT_LABEL}</div>
              <div style={{ marginTop: 2, color: "#16a34a", fontWeight: 800 }}>
                活動折扣　- {ntd1(discountAmt)}
              </div>
              <div style={{ marginTop: 2, color: "#111", fontWeight: 900 }}>
                折扣後總額　{ntd1(totalAfterDiscount)}
              </div>
            </div>
          </section>
        </div>

        {/* 底部操作 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: "1px solid #eee", background: "#fff" }}>
          <button onClick={onClose} style={opBtn}>關閉</button>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <div>小計：<b>{fmt1(total)}</b></div>
            <div>折後：<b>{ntd1(totalAfterDiscount)}</b></div>
            <button onClick={addSelectedToCart} style={primaryBtn}>加入購物袋</button>
          </div>
        </div>
      </div>

      {reviewItem && (
        <ReviewModal
          open={!!reviewItem}
          onClose={() => setReviewItem(null)}
          itemId={reviewItem.id}
          itemName={reviewItem.name}
        />
      )}
    </div>
  );
}

/* styles */
const primaryBtn = { padding: "8px 12px", borderRadius: 10, border: "2px solid #111", background: "#fff", fontWeight: 900, cursor: "pointer" };
const opBtn = { padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" };
const linkBtn = { padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" };
const badgeStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", background: "#f1f5f9", color: "#0f172a", borderRadius: 999, fontSize: 12 };
