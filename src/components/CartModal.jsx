// src/components/CartModal.jsx — 顯示剩餘可訂購（只看 soldCount）
import React, { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase.js";
import { ref, push, set, get, onValue, runTransaction } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";
import { useCart } from "../store/useCart.js";
import { announce } from "../utils/announce.js";

// 折扣工具
import { DISCOUNT, calcPriceBreakdown, makeDiscountMeta, ntd1 } from "../utils/pricing.js";

const fmt1 = (n) =>
  new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(n) || 0);

// 讀取 products → Map
function useProductsMap() {
  const [map, setMap] = useState(new Map());
  useEffect(() => {
    const off = onValue(ref(db, "products"), (snap) => {
      const v = snap.val() || {};
      setMap(
        new Map(
          Object.entries(v).map(([id, p]) => [id, { id, ...p }])
        )
      );
    });
    return () => off();
  }, []);
  return map;
}

// 對某個商品，將 soldCount + addQty
async function commitSoldCount(productId, addQty) {
  const nodeRef = ref(db, `stock/${productId}`);
  await runTransaction(nodeRef, (data) => {
    const n = data || {};
    const prev = Number(n.soldCount || 0);
    n.soldCount = prev + Math.max(0, Number(addQty || 0));
    return n;
  });
}

export default function CartModal({ onClose }) {
  const { isAnonymous, openLoginGate, roleName, avatar, uid } = usePlayer();
  const { items = [], reload } = useCart();
  const productsMap = useProductsMap();
  const [placing, setPlacing] = useState(false);

  const myAvatar = avatar || "bunny";
  const myAvatarUrl = null;

  // 讀取 /stock（只看 soldCount）
  const [stock, setStock] = useState({});
  useEffect(() => {
    const off = onValue(ref(db, "stock"), (snap) => {
      setStock(snap.val() || {});
    });
    return () => off();
  }, []);

  // 小計
  const subtotal = useMemo(
    () =>
      items.reduce(
        (s, x) =>
          s + (Number(x.price) || 0) * (Number(x.qty) || 0),
        0
      ),
    [items]
  );

  // 補充產品資訊
  const enriched = items.map((it) => {
    const p = productsMap.get(String(it.id)) || {};
    return {
      ...it,
      minQty: Math.max(1, Number(p?.minQty || 1)),
      stockCapacity: Number(p?.stockCapacity || 0),
      price: Number(p?.price ?? it.price ?? 0),
      name: p?.name || it.name,
      unit: p?.unit || it.unit || "",
    };
  });

  // 折扣
  const {
    discount: discountAmt,
    totalAfterDiscount,
    label: DISCOUNT_LABEL,
  } = useMemo(
    () => calcPriceBreakdown(enriched, DISCOUNT),
    [enriched]
  );

  // 調整數量：只改 carts，不預留
  const changeQty = async (stallId, id, deltaOrValue) => {
    try {
      const me = auth.currentUser?.uid;
      if (!me) return;
      const key = `${stallId}|${id}`;
      const prev =
        enriched.find(
          (it) => it.stallId === stallId && it.id === id
        ) || {};
      const minQ = Math.max(1, Number(prev.minQty || 1));

      let nextQty;
      if (
        typeof deltaOrValue === "number" &&
        Math.abs(deltaOrValue) < 99
      ) {
        // 加減一顆
        nextQty = Math.max(
          0,
          (Number(prev?.qty) || 0) + Math.sign(deltaOrValue) * 1
        );
      } else {
        // 直接輸入數字
        const raw = Math.max(0, Number(deltaOrValue) || 0);
        nextQty = Math.floor(raw);
      }

      if (nextQty > 0 && nextQty < minQ) nextQty = minQ;

      if (nextQty <= 0) {
        await set(ref(db, `carts/${me}/items/${key}`), null);
      } else {
        await set(ref(db, `carts/${me}/items/${key}`), {
          stallId,
          id,
          name: prev.name,
          price: Number(prev.price || 0),
          qty: nextQty,
        });
      }
      await set(ref(db, `carts/${me}/updatedAt`), Date.now());
      await reload?.();
    } catch (e) {
      console.error("[changeQty] failed", e);
      alert("修改數量失敗，請稍後再試");
    }
  };

  const removeItem = async (stallId, id) => {
    try {
      const me = auth.currentUser?.uid;
      if (!me) return;
      const key = `${stallId}|${id}`;
      await set(ref(db, `carts/${me}/items/${key}`), null);
      await set(ref(db, `carts/${me}/updatedAt`), Date.now());
      await reload?.();
    } catch (e) {
      console.error("[removeItem] failed", e);
      alert("刪除失敗，請稍後再試");
    }
  };

  // 關單檢查（保留）
  async function buildFilteredItemsIfNeeded(items0) {
    const uniqueStalls = Array.from(
      new Set(items0.map((i) => String(i.stallId)))
    );
    const closedMap = {};
    const now = Date.now();

    for (const sid of uniqueStalls) {
      try {
        const snap = await get(ref(db, `stalls/${sid}/campaign`));
        const v = snap.val() || null;
        const closeAt = v?.closeAt ? Number(v.closeAt) : null;
        const status = String(v?.status || "ongoing");
        const ended =
          (closeAt && now >= closeAt) || status === "ended";
        closedMap[sid] = !!ended;
      } catch {
        closedMap[sid] = false;
      }
    }

    const expired = items0.filter(
      (it) => closedMap[String(it.stallId)]
    );
    if (expired.length === 0)
      return { ok: true, finalItems: items0 };

    const stallNames = Array.from(
      new Set(expired.map((i) => i.stallId))
    ).join("、");
    const proceed = window.confirm(
      `${stallNames} 已截止，是否只送未截止的品項？\n按「確定」會自動剔除已截止的品項。`
    );
    if (!proceed)
      return { ok: false, finalItems: [] };

    const kept = items0.filter(
      (it) => !closedMap[String(it.stallId)]
    );
    if (kept.length === 0) {
      alert("目前所有品項都已截止，無法送單。");
      return { ok: false, finalItems: [] };
    }
    return { ok: true, finalItems: kept };
  }

  // 送單（只看 soldCount + stockCapacity）
  const handleCheckout = async () => {
    if (placing || !enriched.length) return;
    if (isAnonymous) {
      openLoginGate({
        to: "login",
        next: "checkout",
        resumeAction: () => handleCheckout(),
      });
      return;
    }

    try {
      setPlacing(true);

      const { ok, finalItems } =
        await buildFilteredItemsIfNeeded(enriched);
      if (!ok) {
        setPlacing(false);
        return;
      }

      // 檢查 minQty
      for (const it of finalItems) {
        const minQ = Math.max(1, Number(it.minQty || 1));
        if (
          Number(it.qty || 0) > 0 &&
          Number(it.qty || 0) < minQ
        ) {
          alert(
            `「${it.name}」的數量至少需要 ${minQ}。`
          );
          setPlacing(false);
          return;
        }
      }

      // 全體上限檢查：soldCount + 這次要買的數量
      for (const it of finalItems) {
        const capacity = Number(it.stockCapacity || 0);
        const want = Math.max(
          0,
          Number(it.qty || 0)
        );
        if (!capacity || !want) continue;

        const soldSnap = await get(
          ref(db, `stock/${it.id}/soldCount`)
        );
        const sold = Number(soldSnap.val() || 0);
        if (sold + want > capacity) {
          const remaining = Math.max(
            0,
            capacity - sold
          );
          if (remaining <= 0) {
            alert(
              `「${it.name}」已達團購上限 ${capacity} 份，現在已額滿，無法再下單。`
            );
          } else {
            alert(
              `「${it.name}」的團購上限為 ${capacity} 份，目前已售出 ${sold} 份，剩餘可下單數量為 ${remaining}。\n\n請先調整購物袋中的數量（最多 ${remaining} 份）再重新送出訂單。`
            );
          }
          setPlacing(false);
          return;
        }
      }

      // 取得真實姓名（若有）
      let realName = "";
      try {
        const snap = await get(
          ref(db, `playersPrivate/${uid}/realName`)
        );
        realName = String(snap.val() || "");
      } catch {}

      // 實際將 soldCount 加上本次訂單的數量
      for (const it of finalItems) {
        const want = Math.max(
          0,
          Number(it.qty || 0)
        );
        if (!want) continue;
        await commitSoldCount(it.id, want);
      }

      // 建立訂單 payload
      const orderRef = push(ref(db, "orders"));
      const orderItems = finalItems.map((it) => ({
        stallId: it.stallId,
        id: it.id,
        name: it.name,
        price: Number(it.price) || 0,
        qty: Number(it.qty) || 0,
      }));

      const breakdown = calcPriceBreakdown(
        orderItems,
        DISCOUNT
      );

      const payload = {
        uid,
        orderedBy: {
          uid,
          roleName: roleName || "旅人",
          avatar: myAvatar,
          avatarUrl: myAvatarUrl || null,
          realName: realName || null,
        },
        items: orderItems,

        // 舊欄位相容
        total: breakdown.subtotal,

        // 新欄位
        subtotal: breakdown.subtotal,
        discount: breakdown.discount,
        totalAfterDiscount: breakdown.totalAfterDiscount,
        discountMeta: makeDiscountMeta(DISCOUNT),

        status: "submitted",
        paid: false,
        paidAt: null,
        last5: null,
        createdAt: Date.now(),
      };
      await set(orderRef, payload);

      try {
        await announce(
          `${roleName || "有人"}送出了一筆訂單`
        );
      } catch {}

      // 清空購物袋
      if (auth.currentUser) {
        await set(
          ref(db, `carts/${auth.currentUser.uid}`),
          { items: {}, updatedAt: Date.now() }
        );
      }
      await reload?.();
      onClose?.();
      alert("訂單已送出！");
    } catch (err) {
      console.error(err);
      alert("送單失敗，請稍後再試");
    } finally {
      setPlacing(false);
    }
  };

  // 登入成功 → 自動送單
  useEffect(() => {
    const onOk = (e) => {
      if (e?.detail?.next === "checkout")
        handleCheckout();
    };
    window.addEventListener("login-success", onOk);
    return () =>
      window.removeEventListener("login-success", onOk);
  }, [enriched, subtotal, uid, roleName, avatar, placing, isAnonymous]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 160,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(980px,96vw)",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #eee",
          boxShadow: "0 20px 48px rgba(0,0,0,.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px",
            borderBottom: "1px solid #eee",
            background: "#f9fafb",
          }}
        >
          <h3 style={{ margin: 0 }}>購物袋</h3>
          <button
            onClick={onClose}
            aria-label="關閉"
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: 16,
            overflow: "auto",
            maxHeight: "68vh",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead style={{ background: "#fafafa" }}>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: 8,
                    width: 120,
                  }}
                >
                  攤位
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: 8,
                  }}
                >
                  品項
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: 8,
                    width: 80,
                  }}
                >
                  單價
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: 8,
                    width: 160,
                  }}
                >
                  數量
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: 8,
                    width: 120,
                  }}
                >
                  小計
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: 8,
                    width: 80,
                  }}
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {enriched.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    style={{
                      padding: 12,
                      textAlign: "center",
                      color: "#888",
                    }}
                  >
                    購物袋是空的
                  </td>
                </tr>
              ) : (
                enriched.map((it) => {
                  const sub =
                    (Number(it.price) || 0) *
                    (Number(it.qty) || 0);

                  // 剩餘可訂購（只看 soldCount）
                  const stockNode = stock[it.id] || {};
                  const sold = Number(
                    stockNode.soldCount || 0
                  );
                  const capacity = Number(
                    it.stockCapacity || 0
                  );
                  const remaining =
                    capacity > 0
                      ? Math.max(0, capacity - sold)
                      : null;
                  const overLimit =
                    remaining != null &&
                    Number(it.qty || 0) > remaining;

                  return (
                    <tr
                      key={`${it.stallId}|${it.id}`}
                      style={{
                        borderTop:
                          "1px solid #f0f0f0",
                      }}
                    >
                      <td style={{ padding: 8 }}>
                        {it.stallId}
                      </td>
                      <td style={{ padding: 8 }}>
                        {it.name}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          textAlign: "right",
                        }}
                      >
                        {fmt1(it.price)}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "inline-flex",
                            flexDirection:
                              "column",
                            alignItems:
                              "center",
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              display:
                                "inline-flex",
                              alignItems:
                                "center",
                              gap: 8,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                changeQty(
                                  it.stallId,
                                  it.id,
                                  -1
                                )
                              }
                              className="small-btn"
                            >
                              −
                            </button>
                            <input
                              value={
                                Number(
                                  it.qty
                                ) || 0
                              }
                              onChange={(e) =>
                                changeQty(
                                  it.stallId,
                                  it.id,
                                  e.target
                                    .value
                                )
                              }
                              inputMode="numeric"
                              pattern="[0-9]*"
                              step={1}
                              min={0}
                              style={{
                                width: 56,
                                textAlign:
                                  "center",
                                border:
                                  "1px solid #ddd",
                                borderRadius: 8,
                                padding:
                                  "6px 4px",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                changeQty(
                                  it.stallId,
                                  it.id,
                                  +1
                                )
                              }
                              className="small-btn"
                            >
                              ＋
                            </button>
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color:
                                "#64748b",
                            }}
                          >
                            至少 {it.minQty}
                          </div>
                          {capacity > 0 && (
                            <div
                              style={{
                                fontSize: 11,
                                color: overLimit
                                  ? "#ef4444"
                                  : "#16a34a",
                              }}
                            >
                              剩餘可訂購：
                              <b>
                                {remaining}
                              </b>
                              {it.unit ||
                                "份"}
                              {overLimit &&
                                "（請調整）"}
                            </div>
                          )}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: 8,
                          textAlign: "right",
                          fontWeight: 700,
                        }}
                      >
                        {fmt1(sub)}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          textAlign: "center",
                        }}
                      >
                        <button
                          onClick={() =>
                            removeItem(
                              it.stallId,
                              it.id
                            )
                          }
                          style={{
                            padding:
                              "6px 10px",
                            borderRadius: 10,
                            border:
                              "1px solid #ddd",
                            background: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          移除
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 金額 & 折扣 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "0 16px 6px",
          }}
        >
          <div style={{ color: "#666" }}>
            共 {enriched.length} 項
          </div>
          <div
            style={{
              fontWeight: 900,
              fontSize: 18,
            }}
          >
            合計 NT$ {fmt1(subtotal)}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "0 16px 0",
          }}
        >
          
        </div>

        {/* 底部按鈕 */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "8px 16px 16px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
            }}
          >
            關閉
          </button>
          <button
            onClick={handleCheckout}
            disabled={placing || enriched.length === 0}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "2px solid #333",
              background: "#fff",
              fontWeight: 800,
              cursor: placing
                ? "not-allowed"
                : "pointer",
            }}
          >
            {placing
              ? "送出中…"
              : isAnonymous
              ? "先登入再送單"
              : "送出訂單"}
          </button>
        </div>
      </div>
    </div>
  );
}
