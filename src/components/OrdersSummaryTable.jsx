// src/components/OrdersSummaryTable.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { onValue, ref, update } from "firebase/database";

// 將 orders 彙總成「每人每品項小計」
function aggregate(orders) {
  const rowsByName = {}; // name -> { name, items: {itemKey: qty}, totalQty, totalMoney, paid }
  Object.values(orders || {}).forEach((o) => {
    const name = o.name || "未知";
    const itemKey = o.itemName || o.itemId || "未命名品項";
    const qty = Number(o.qty || 0);
    const money = Number(o.total || 0);
    const paid = !!o.paid;

    if (!rowsByName[name]) {
      rowsByName[name] = {
        name,
        items: {},
        totalQty: 0,
        totalMoney: 0,
        paid: false,
      };
    }
    rowsByName[name].items[itemKey] = (rowsByName[name].items[itemKey] || 0) + qty;
    rowsByName[name].totalQty += qty;
    rowsByName[name].totalMoney += money;
    // 只要其中一筆已付款，就視為該人已付款
    rowsByName[name].paid = rowsByName[name].paid || paid;
  });
  return Object.values(rowsByName);
}

export default function OrdersSummaryTable() {
  const [orders, setOrders] = useState({});

  useEffect(() => {
    const off = onValue(ref(db, "orders"), (snap) => {
      const val = snap.val() || {};
      // 帶回 id 方便後續更新 paid
      const withIds = Object.fromEntries(
        Object.entries(val).map(([k, v]) => [k, { ...v, id: k }])
      );
      setOrders(withIds);
    });
    return () => off();
  }, []);

  const rows = useMemo(() => aggregate(orders), [orders]);

  // 取得「所有出現過的品項」當作欄位
  const allItems = useMemo(() => {
    const s = new Set();
    Object.values(orders).forEach((o) => s.add(o.itemName || o.itemId || "未命名品項"));
    return Array.from(s);
  }, [orders]);

  // 切換某位使用者的付款狀態：把屬於他的所有訂單 paid 同步更新
  const togglePaid = async (name, toPaid) => {
    const updates = {};
    Object.entries(orders).forEach(([id, o]) => {
      if ((o.name || "未知") === name) {
        updates[`orders/${id}/paid`] = !!toPaid;
      }
    });
    if (Object.keys(updates).length) {
      await update(ref(db), updates);
    }
  };

  // 合計工具
  const sumQtyForItem = (itemKey) =>
    rows.reduce((s, r) => s + (r.items[itemKey] || 0), 0);
  const grandQty = rows.reduce((s, r) => s + r.totalQty, 0);
  const grandMoney = rows.reduce((s, r) => s + r.totalMoney, 0);

  return (
    <div
      style={{
        background: "rgba(255,255,255,.95)",
        border: "1px solid #f0d9b5",
        borderRadius: 12,
        maxWidth: 1000,
        overflowX: "auto",
        boxShadow: "0 8px 24px rgba(0,0,0,.15)",
      }}
    >
      <table style={{ borderCollapse: "collapse", minWidth: 800 }}>
        <thead>
          <tr style={{ background: "#fff2d9" }}>
            <th style={{ padding: 8 }}>姓名</th>
            {allItems.map((itemKey) => (
              <th key={`head-${itemKey}`} style={{ padding: 8 }}>
                {itemKey}
              </th>
            ))}
            <th style={{ padding: 8 }}>總數</th>
            <th style={{ padding: 8 }}>金額</th>
            <th style={{ padding: 8 }}>已付款</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`row-${r.name}`} style={{ borderTop: "1px solid #f2f2f2" }}>
              <td style={{ padding: 8, fontWeight: 600 }}>{r.name}</td>
              {allItems.map((itemKey) => (
                <td key={`cell-${r.name}-${itemKey}`} style={{ padding: 8 }} align="center">
                  {r.items[itemKey] || ""}
                </td>
              ))}
              <td style={{ padding: 8 }} align="center">
                {r.totalQty}
              </td>
              <td style={{ padding: 8 }} align="right">
                {r.totalMoney}
              </td>
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
          <tr
            style={{
              borderTop: "2px solid #e8d6b6",
              background: "#fffaf0",
              fontWeight: 700,
            }}
          >
            <td style={{ padding: 8 }}>合計</td>
            {allItems.map((itemKey) => (
              <td key={`sum-${itemKey}`} style={{ padding: 8 }} align="center">
                {sumQtyForItem(itemKey) || ""}
              </td>
            ))}
            <td style={{ padding: 8 }} align="center">
              {grandQty}
            </td>
            <td style={{ padding: 8 }} align="right">
              {grandMoney}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
