// src/components/OrdersSummaryTable.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { onValue, ref, update } from "firebase/database";

// 小工具：把 orders 轉成「每人每品項小計」
function aggregate(orders) {
  const rows = {};     // rows[name] = { name, items:{itemName: qty}, totalQty, totalMoney, paid }
  Object.values(orders || {}).forEach((o) => {
    const name = o.name || "未知";
    const item = o.itemName || o.itemId;
    const money = Number(o.total || 0);
    if (!rows[name]) rows[name] = { name, items: {}, totalQty: 0, totalMoney: 0, paid: false, anyIds: [] };
    rows[name].items[item] = (rows[name].items[item] || 0) + Number(o.qty || 0);
    rows[name].totalQty += Number(o.qty || 0);
    rows[name].totalMoney += money;
    rows[name].paid = rows[name].paid || !!o.paid;
    rows[name].anyIds.push(o.id || ""); // optional
  });
  return Object.values(rows);
}

export default function OrdersSummaryTable() {
  const [orders, setOrders] = useState({});

  useEffect(() => {
    const off = onValue(ref(db, "orders"), (snap) => {
      // 把 key 帶回去（之後若要就地更新 paid 可用）
      const val = snap.val() || {};
      const withIds = Object.fromEntries(Object.entries(val).map(([k, v]) => [k, { ...v, id: k }]));
      setOrders(withIds);
    });
    return () => off();
  }, []);

  const rows = useMemo(() => aggregate(orders), [orders]);
  const allItems = useMemo(() => {
    const set = new Set();
    Object.values(orders).forEach((o) => set.add(o.itemName || o.itemId));
    return Array.from(set);
  }, [orders]);

  const togglePaid = async (name, toPaid) => {
    // 把屬於此 name 的訂單全部打勾/取消
    const updates = {};
    Object.entries(orders).forEach(([id, o]) => {
      if ((o.name || "未知") === name) updates[`orders/${id}/paid`] = !!toPaid;
    });
    await update(ref(db), updates);
  };

  return (
    <div style={{
      background: "rgba(255,255,255,.95)", border: "1px solid #f0d9b5", borderRadius: 12,
      maxWidth: 1000, overflowX: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.15)"
    }}>
      <table style={{ borderCollapse: "collapse", minWidth: 800 }}>
        <thead>
          <tr style={{ background: "#fff2d9" }}>
            <th style={{ padding: 8 }}>姓名</th>
            {allItems.map((i) => (
              <th key={i} style={{ padding: 8 }}>{i}</th>
            ))}
            <th style={{ padding: 8 }}>總數</th>
            <th style={{ padding: 8 }}>金額</th>
            <th style={{ padding: 8 }}>已付款</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} style={{ borderTop: "1px solid #f2f2f2" }}>
              <td style={{ padding: 8, fontWeight: 600 }}>{r.name}</td>
              {allItems.map((i) => (
                <td key={i} style={{ padding: 8 }} align="center">{r.items[i] || ""}</td>
              ))}
              <td style={{ padding: 8 }} align="center">{r.totalQty}</td>
              <td style={{ padding: 8 }} align="right">{r.totalMoney}</td>
              <td style={{ padding: 8 }} align="center">
                <input
                  type="checkbox"
                  checked={r.paid}
                  onChange={(e) => togglePaid(r.name, e.target.checked)}
                />
              </td>
            </tr>
          ))}
          {/* 合計列 */}
          <tr style={{ borderTop: "2px solid #e8d6b6", background: "#fffaf0", fontWeight: 700 }}>
            <td style={{ padding: 8 }}>合計</td>
            {allItems.map((i) => {
              const sum = rows.reduce((s, r) => s + (r.items[i] || 0), 0);
              return <td key={i} style={{ padding: 8 }} align="center">{sum || ""}</td>;
            })}
            <td style={{ padding: 8 }} align="center">
              {rows.reduce((s, r) => s + r.totalQty, 0)}
            </td>
            <td style={{ padding: 8 }} align="right">
              {rows.reduce((s, r) => s + r.totalMoney, 0)}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
