// src/components/OrderHistoryModal.jsx — 可覆蓋版（最小更動）
// 變更點：saveEdit() 內，數量為 0 的品項改以刪除節點（設為 null），符合 rules：qty >= 1。
// 其餘維持原行為：分「本次開團 / 歷史」、未付款可編輯、僅有折扣欄位才顯示折扣區塊。

import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import {
  onValue,
  ref as dbRef,
  query,
  limitToLast,
  update as rtdbUpdate,
  remove,
} from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";
import { ntd1 } from "../utils/pricing.js";

/* ---- 通用 Modal ---- */
function Modal({ open, onClose, title = "訂購紀錄", children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        zIndex: 1200,
        display: "grid",
        placeItems: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(960px,96vw)",
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 16,
          boxShadow: "0 20px 48px rgba(0,0,0,.2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "8px 14px",
            background: "#f9fafb",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <b>{title}</b>
          <button
            onClick={onClose}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ maxHeight: "72vh", overflow: "auto", padding: 12 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ---- 折扣區塊（只有有折扣欄位才顯示） ---- */
function DiscountBlock({ orderLike, items, isEditing }) {
  const hasDiscountField =
    typeof orderLike?.subtotal === "number" ||
    typeof orderLike?.discount === "number" ||
    typeof orderLike?.totalAfterDiscount === "number" ||
    (orderLike?.discountMeta && orderLike?.discountMeta?.perItem != null);

  if (!hasDiscountField) return null;

  // 編輯時的小計即時計算；非編輯則用 DB 的 subtotal（若無則回退即時計算）
  const liveSubtotal = (Array.isArray(items) ? items : []).reduce(
    (s, it) => s + Number(it.price || 0) * Number(it.qty || 0),
    0
  );
  const subtotal = isEditing
    ? liveSubtotal
    : typeof orderLike?.subtotal === "number"
    ? orderLike.subtotal
    : liveSubtotal;

  const discount =
    typeof orderLike?.discount === "number" ? orderLike.discount : 0;

  const payable =
    typeof orderLike?.totalAfterDiscount === "number"
      ? orderLike.totalAfterDiscount
      : Math.max(0, subtotal - discount);

  const label = orderLike?.discountMeta?.label || "折扣活動";

  return (
    <div style={{ textAlign: "right", marginTop: 8 }}>
      <div style={{ color: "#111", fontWeight: 800 }}>
        小計　{ntd1(subtotal)}
      </div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ marginTop: 2, color: "#16a34a", fontWeight: 800 }}>
        活動折扣　- {ntd1(discount)}
      </div>
      <div style={{ marginTop: 2, color: "#111", fontWeight: 900 }}>
        折扣後總額　{ntd1(payable)}
      </div>
    </div>
  );
}

/* ---- 主元件 ---- */
export default function OrderHistoryModal({ open, onClose }) {
  const { uid } = usePlayer() || {};
  const [orders, setOrders] = useState([]);
  const [campaign, setCampaign] = useState({ updatedAt: 0 });
  const [editing, setEditing] = useState(null); // { id, paid, items:[{...}], orig:[{...}] }

  // 讀取我的訂單 & 當前開團分界時間
  useEffect(() => {
    if (!open || !uid) return;

    const qOrders = query(dbRef(db, "orders"), limitToLast(500));
    const offOrders = onValue(qOrders, (snap) => {
      const v = snap.val() || {};
      const list = Object.entries(v)
        .map(([id, o]) => ({ id, ...(o || {}) }))
        .filter((o) => String(o.uid || "") === String(uid));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOrders(list);
    });

    const offC = onValue(dbRef(db, "campaign/current"), (snap) => {
      const v = snap.val() || {};
      setCampaign({ updatedAt: Number(v?.updatedAt || 0) });
    });

    return () => {
      offOrders();
      offC();
    };
  }, [open, uid]);

  const startTs = Number(campaign.updatedAt || 0);
  const currentCampaign = useMemo(
    () => orders.filter((o) => Number(o.createdAt || 0) >= startTs),
    [orders, startTs]
  );
  const history = useMemo(
    () => orders.filter((o) => Number(o.createdAt || 0) < startTs),
    [orders, startTs]
  );

  /* ---- 編輯流程 ---- */
  const beginEdit = (o) => {
    const itemsArray = Array.isArray(o.items) ? o.items : [];
    setEditing({
      id: o.id,
      paid: !!o.paid,
      items: itemsArray.map((x) => ({ ...x, qty: Number(x.qty || 0) })), // 可編輯
      orig: itemsArray.map((x) => ({ ...x, qty: Number(x.qty || 0) })), // 原始值
    });
  };
  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;

    const curr = editing.items || [];
    const orig = editing.orig || [];
    const orderPath = `orders/${editing.id}`;
    const updates = {};

    // 規則限制 qty >= 1：把 afterQty===0 的品項「刪除節點」而非寫入 0
    for (let i = 0; i < curr.length; i++) {
      const beforeQty = Number(orig[i]?.qty || 0);
      const afterQty = Math.max(0, Math.floor(Number(curr[i]?.qty || 0)));

      if (afterQty === 0 && beforeQty > 0) {
        updates[`${orderPath}/items/${i}`] = null; // 刪除此品項
      } else if (afterQty !== beforeQty) {
        updates[`${orderPath}/items/${i}/qty`] = afterQty; // 更新數量（>=1）
      }
    }

    // 以剩餘品項（qty>0）重算「未折扣小計」total（沿用舊欄位語意）
    const itemsForTotal = curr.filter((x) => Number(x.qty) > 0);
    const newTotal = itemsForTotal.reduce(
      (s, it) => s + Number(it.price || 0) * Number(it.qty || 0),
      0
    );
    updates[`${orderPath}/total`] = newTotal;

    try {
      await rtdbUpdate(dbRef(db), updates);
      setEditing(null);
    } catch (e) {
      console.error(e);
      alert("儲存失敗，請稍後再試");
    }
  };

  const deleteOrder = async (id) => {
    if (!window.confirm("確定要刪除此訂單嗎？此動作無法復原。")) return;
    try {
      await remove(dbRef(db, `orders/${id}`));
    } catch (e) {
      console.error(e);
      alert("刪除失敗，請稍後再試");
    }
  };

  /* ---- 共用訂單卡片 ---- */
  const renderOrderCard = (o, allowEdit) => {
    const isEditing = editing && editing.id === o.id;
    const items = isEditing ? editing.items : o.items || [];

    const legacyTotal = isEditing
      ? items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0)
      : Number(o.total || 0);

    return (
      <div key={o.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
        {/* 標頭（左：時間；右：未折扣小計） */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <b>訂單</b>{" "}
            <span style={{ color: "#94a3b8", fontSize: 12 }}>
              {o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}
            </span>
          </div>
          <div style={{ fontWeight: 900 }}>{ntd1(legacyTotal)}</div>
        </div>

        {/* 明細列表（編輯 or 檢視） */}
        {Array.isArray(items) && items.length > 0 ? (
          <table style={{ width: "100%", marginTop: 6, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                <th style={{ textAlign: "left", padding: 6 }}>品項</th>
                <th style={{ textAlign: "right", padding: 6, width: 80 }}>單價</th>
                <th style={{ textAlign: "right", padding: 6, width: 80 }}>數量</th>
                <th style={{ textAlign: "right", padding: 6, width: 110 }}>小計</th>
                {isEditing ? <th style={{ width: 60 }} /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const sub = Number(it.price || 0) * Number(it.qty || 0);
                return (
                  <tr key={i}>
                    <td style={{ padding: 6 }}>{it.name}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>{ntd1(it.price || 0)}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={editing.items[i].qty}
                          onChange={(e) => {
                            const q = Math.max(0, Math.floor(Number(e.target.value || 0)));
                            setEditing((s) => {
                              const next = { ...s };
                              next.items = [...next.items];
                              next.items[i] = { ...next.items[i], qty: q };
                              return next;
                            });
                          }}
                          style={{
                            width: 72,
                            padding: "6px 8px",
                            border: "1px solid #ddd",
                            borderRadius: 8,
                            textAlign: "right",
                          }}
                        />
                      ) : (
                        Number(it.qty || 0)
                      )}
                    </td>
                    <td style={{ padding: 6, textAlign: "right" }}>{ntd1(sub)}</td>
                    {isEditing ? (
                      <td style={{ padding: 6, textAlign: "right" }}>
                        <button
                          onClick={() =>
                            setEditing((s) => {
                              const next = { ...s };
                              next.items = next.items.map((x, idx) =>
                                idx === i ? { ...x, qty: 0 } : x
                              );
                              return next;
                            })
                          }
                          title="將此品項數量改為 0"
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #ddd",
                            background: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          刪
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ color: "#64748b", marginTop: 6 }}>（無品項）</div>
        )}

        {/* 折扣（只有有折扣欄位才顯示） */}
        <DiscountBlock orderLike={o} items={items} isEditing={isEditing} />

        {/* 操作列 */}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {allowEdit && !isEditing && (
            <>
              <button onClick={() => beginEdit(o)} style={opBtn}>編輯</button>
              <button onClick={() => deleteOrder(o.id)} style={dangerBtn}>刪除</button>
            </>
          )}
          {isEditing && (
            <>
              <button onClick={saveEdit} style={primaryBtn}>儲存</button>
              <button onClick={cancelEdit} style={opBtn}>取消</button>
            </>
          )}
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
            {o.paid ? "已付款" : "未付款"} {o.last5 ? `｜末五碼 ${o.last5}` : ""}
          </div>
        </div>
      </div>
    );
  };

  /* ---- Render ---- */
  return (
    <Modal open={open} onClose={onClose} title="我的訂購紀錄">
      {/* 本次開團 */}
      <section style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>本次開團的訂購紀錄</div>
        {currentCampaign.length === 0 ? (
          <div style={{ color: "#64748b" }}>目前尚未送出訂單</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {currentCampaign.map((o) =>
              renderOrderCard(o, o.uid && String(o.uid) === String(uid) && !o.paid)
            )}
          </div>
        )}
      </section>

      {/* 歷史訂購紀錄 */}
      <section>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>歷史訂購紀錄</div>
        {history.length === 0 ? (
          <div style={{ color: "#64748b" }}>尚無歷史訂單</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {history.map((o) => renderOrderCard(o, false))}
          </div>
        )}
      </section>
    </Modal>
  );
}

/* ---- styles ---- */
const primaryBtn = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "2px solid #111",
  background: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};
const opBtn = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
};
const dangerBtn = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "2px solid #ef4444",
  background: "#fff",
  color: "#ef4444",
  fontWeight: 900,
  cursor: "pointer",
};
