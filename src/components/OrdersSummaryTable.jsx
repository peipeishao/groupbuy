// src/components/OrdersSummaryTable.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { onValue, ref, update, serverTimestamp } from "firebase/database";

const AVATAR_EMOJI = { bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" };

function aggregateByItem(ordersArr) {
  const map = new Map(); // key: stallId|id
  for (const o of ordersArr) {
    for (const it of o.items || []) {
      const key = `${it.stallId}|${it.id}`;
      const prev = map.get(key) || { stallId: it.stallId, id: it.id, name: it.name, totalQty: 0, totalAmount: 0 };
      const qty = Number(it.qty) || 0;
      const price = Number(it.price) || 0;
      prev.totalQty += qty;
      prev.totalAmount += qty * price;
      map.set(key, prev);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => a.stallId.localeCompare(b.stallId) || a.name.localeCompare(b.name, "zh-Hant")
  );
}

export default function OrdersSummaryTable() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const off = onValue(ref(db, "orders"), (snap) => {
      const v = snap.val() || {};
      const list = Object.entries(v).map(([id, o]) => ({
        id,
        ...o,
      }));
      // 依建立時間排序（serverTimestamp → 毫秒）
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setOrders(list);
    });
    return () => off();
  }, []);

  const totals = useMemo(() => aggregateByItem(orders), [orders]);

  const markPaid = async (orderId, nextPaid) => {
    await update(ref(db, `orders/${orderId}`), {
      paid: nextPaid,
      paidAt: nextPaid ? serverTimestamp() : null,
      status: nextPaid ? "paid" : "submitted",
    });
  };

  const grandTotal = useMemo(
    () => orders.reduce((s, o) => s + (Number(o.total) || 0), 0),
    [orders]
  );

  return (
    <div style={{ background: "#fff", padding: 12, borderRadius: 12, width: 980 }}>
      {/* 訂單列表 */}
      <h3 style={{ marginTop: 0 }}>訂單列表</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#fff2d9" }}>
            <th style={{ textAlign: "left", padding: 8 }}>頭像</th>
            <th style={{ textAlign: "left", padding: 8 }}>角色名稱</th>
            <th style={{ textAlign: "left", padding: 8, width: "50%" }}>訂購清單</th>
            <th style={{ textAlign: "right", padding: 8 }}>總金額</th>
            <th style={{ textAlign: "center", padding: 8 }}>已付款</th>
            <th style={{ textAlign: "center", padding: 8 }}>末五碼</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const avatarKey = o?.orderedBy?.avatar || "bunny";
            const emoji = AVATAR_EMOJI[avatarKey] || "🙂";
            const roleName = o?.orderedBy?.roleName || (o?.uid ? String(o.uid).slice(0,6) : "旅人");
            const line = (o.items || [])
              .map((it) => `${it.name}×${it.qty}`)
              .join("、");

            return (
              <tr key={o.id} style={{ borderTop: "1px solid #f2f2f2" }}>
                <td style={{ padding: 8 }}>
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 999,
                      background: "#f7f7f7", display: "grid", placeItems: "center",
                      border: "1px solid #eee"
                    }}
                    title={avatarKey}
                  >
                    <span style={{ fontSize: 20 }}>{emoji}</span>
                  </div>
                </td>
                <td style={{ padding: 8, fontWeight: 600 }}>{roleName}</td>
                <td style={{ padding: 8 }}>{line}</td>
                <td style={{ padding: 8, textAlign: "right" }}>🪙 {o.total || 0}</td>
                <td style={{ padding: 8, textAlign: "center" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!o.paid}
                      onChange={(e) => markPaid(o.id, e.target.checked)}
                    />
                    {o.paid ? "已付款" : "未付款"}
                  </label>
                </td>
                <td style={{ padding: 8, textAlign: "center" }}>{o.last5 || "-"}</td>
              </tr>
            );
          })}

          {/* 訂單總金額列 */}
          <tr
            style={{
              borderTop: "2px solid #e8d6b6",
              background: "#fffaf0",
              fontWeight: 700,
            }}
          >
            <td style={{ padding: 8 }} colSpan={3}>所有訂單總金額</td>
            <td style={{ padding: 8, textAlign: "right" }}>🪙 {grandTotal}</td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>

      {/* 分攤合計（每品項匯總） */}
      <h4 style={{ marginTop: 16 }}>分攤合計</h4>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f6f8ff" }}>
            <th style={{ textAlign: "left", padding: 8 }}>攤位</th>
            <th style={{ textAlign: "left", padding: 8 }}>品項</th>
            <th style={{ textAlign: "center", padding: 8 }}>總數</th>
            <th style={{ textAlign: "right", padding: 8 }}>總金額</th>
          </tr>
        </thead>
        <tbody>
          {totals.map((t) => (
            <tr key={`${t.stallId}|${t.id}`} style={{ borderTop: "1px solid #f2f2f2" }}>
              <td style={{ padding: 8 }}>{t.stallId}</td>
              <td style={{ padding: 8 }}>{t.name}</td>
              <td style={{ padding: 8, textAlign: "center" }}>{t.totalQty}</td>
              <td style={{ padding: 8, textAlign: "right" }}>🪙 {t.totalAmount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
