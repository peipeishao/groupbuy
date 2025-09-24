// src/components/OrderHistoryModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { onValue, ref as dbRef, query, limitToLast, update, remove } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";

const ntd1 = (n) =>
  new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(n) || 0);

function Modal({ open, onClose, children, title = "訂購紀錄" }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1200, display: "grid", placeItems: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(960px,96vw)", background: "#fff", border: "1px solid #eee", borderRadius: 16, boxShadow: "0 20px 48px rgba(0,0,0,.2)", overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", background: "#f9fafb", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <b>{title}</b>
          <button onClick={onClose} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}>×</button>
        </div>
        <div style={{ maxHeight: "72vh", overflow: "auto", padding: 12 }}>{children}</div>
      </div>
    </div>
  );
}

export default function OrderHistoryModal({ open, onClose }) {
  const { uid } = usePlayer() || {};
  const [orders, setOrders] = useState([]);
  const [campaign, setCampaign] = useState({ updatedAt: 0 });
  const [editing, setEditing] = useState(null); // {id, paid, items:[], orig:[]}

  useEffect(() => {
    if (!open || !uid) return;
    // 所有訂單取後 500 筆，再過濾自己
    const qOrders = query(dbRef(db, "orders"), limitToLast(500));
    const offOrders = onValue(qOrders, (snap) => {
      const v = snap.val() || {};
      const list = Object.entries(v).map(([id, o]) => ({ id, ...(o || {}) })).filter((o) => String(o.uid || "") === String(uid));
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
  const currentCampaign = useMemo(() => orders.filter((o) => Number(o.createdAt || 0) >= startTs), [orders, startTs]);
  const history = useMemo(() => orders.filter((o) => Number(o.createdAt || 0) < startTs), [orders, startTs]);

  const beginEdit = (o) => {
    const itemsArray = Array.isArray(o.items) ? o.items : [];
    setEditing({
      id: o.id,
      paid: !!o.paid,
      items: itemsArray.map((x) => ({ ...x, qty: Number(x.qty || 0) })), // 可編輯值
      orig: itemsArray.map((x) => ({ ...x, qty: Number(x.qty || 0) })), // 原始快照，用來做 diff
    });
  };
  const cancelEdit = () => setEditing(null);

  // 只送「有變更的 qty」與同步過的 total，避免觸發其他嚴格驗證
  const saveEdit = async () => {
    if (!editing) return;

    // 計算總價（忽略 qty <= 0 的項目）
    const itemsForTotal = (editing.items || []).filter((x) => Number(x.qty) > 0);
    const newTotal = itemsForTotal.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);

    // 比對 orig 與現值，只針對「qty 有變」的 index 寫入
    const updates = {};
    const orig = editing.orig || [];
    const curr = editing.items || [];
    const orderPath = `orders/${editing.id}`;

    // 逐一處理每一個 index
    for (let i = 0; i < curr.length; i++) {
      const before = orig[i] || {};
      const after = curr[i] || {};
      const beforeQty = Number(before.qty || 0);
      const afterQty = Math.max(0, Math.floor(Number(after.qty || 0)));

      // 只要 qty 有變更就寫入；其他欄位不動
      if (afterQty !== beforeQty) {
        // 收單後～出車前，規則只允許改 qty，不允許刪除項目
        // 因此我們在這裡不會把 qty=0 的項目刪掉，只是把 qty 設為 0（若規則不允許，你會得到 permission_denied）
        updates[`${orderPath}/items/${i}/qty`] = afterQty;
      }
    }

    // 同步 total（白名單允許的欄位）
    updates[`${orderPath}/total`] = newTotal;

    // 注意：不要寫 updatedAt（不在白名單，會被擋）
    try {
      await update(dbRef(db), updates);
      setEditing(null);
    } catch (e) {
      console.error(e);
      // 提供更友善的錯誤訊息
      alert(
        "儲存失敗：\n" +
        "• 若已收單，可能僅允許調整數量（不能增刪品項）\n" +
        "• 請確認你是這筆訂單的擁有者或管理員\n" +
        "• 請稍後再試或重新整理頁面"
      );
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

  return (
    <Modal open={open} onClose={onClose} title="我的訂購紀錄">
      {/* 本次開團 */}
      <section style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>本次開團的訂購紀錄</div>
        {currentCampaign.length === 0 ? (
          <div style={{ color: "#64748b" }}>目前尚未送出訂單</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {currentCampaign.map((o) => {
              const canEdit = o.uid && String(o.uid) === String(uid) && !o.paid;
              const isEditing = editing && editing.id === o.id;
              const items = isEditing ? editing.items : (o.items || []);
              const subtotal = (items || []).reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);
              return (
                <div key={o.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <b>訂單</b>{" "}
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>
                        {o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}
                      </span>
                    </div>
                    <div style={{ fontWeight: 900 }}>{ntd1(isEditing ? subtotal : (o.total || 0))}</div>
                  </div>

                  {/* 明細（檢視 or 編輯） */}
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
                                    style={{ width: 72, padding: "6px 8px", border: "1px solid " +
                                      "#ddd", borderRadius: 8, textAlign: "right" }}
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
                                        // 收單後不允許刪除項目；這裡先把 qty 設 0，實際是否允許由規則決定
                                        next.items = next.items.map((x, idx) => idx === i ? { ...x, qty: 0 } : x);
                                        return next;
                                      })
                                    }
                                    title="將此品項數量改為 0"
                                    style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
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

                  {/* 操作 */}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {canEdit && !isEditing && (
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
            })}
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
            {history.map((o) => (
              <div key={o.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <b>訂單</b>{" "}
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>
                      {o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}
                    </span>
                  </div>
                  <div style={{ fontWeight: 900 }}>{ntd1(o.total || 0)}</div>
                </div>

                {Array.isArray(o.items) && o.items.length > 0 && (
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {o.items.map((it, i) => (
                      <li key={i}>
                        {it.name} × {it.qty}（單價 {ntd1(it.price)}）
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </Modal>
  );
}

/* styles */
const primaryBtn = { padding: "8px 12px", borderRadius: 10, border: "2px solid #111", background: "#fff", fontWeight: 900, cursor: "pointer" };
const opBtn = { padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" };
const dangerBtn = { padding: "8px 12px", borderRadius: 10, border: "2px solid #ef4444", background: "#fff", color: "#ef4444", fontWeight: 900, cursor: "pointer" };
