// src/components/AdminOrdersPanel.jsx — 修正版
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { onValue, ref, update } from "firebase/database";

function twd(n) {
  try {
    return (Number(n) || 0).toLocaleString("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0,
    });
  } catch {
    return `NT$${Number(n) || 0}`;
  }
}

export default function AdminOrdersPanel() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const off = onValue(ref(db, "orders"), (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([id, o]) => ({ id, ...o }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOrders(list);
    });
    return () => off();
  }, []);

  const totals = useMemo(() => {
    let qty = 0,
      sum = 0;
    for (const o of orders) {
      for (const it of o.items || []) {
        qty += Number(it.qty) || 0;
        sum += (Number(it.price) || 0) * (Number(it.qty) || 0);
      }
    }
    return { qty, sum };
  }, [orders]);

  async function togglePaid(o) {
    const next = !o.paid;
    try {
      await update(ref(db, `orders/${o.id}`), {
        paid: next,
        paidAt: next ? Date.now() : null,
      });
    } catch (e) {
      console.error("[AdminOrders] update failed", e);
      alert("更新付款狀態失敗：請確認 RTDB 規則允許更新 paid/paidAt");
    }
  }

  const row = {
    display: "grid",
    gridTemplateColumns: "140px 1fr 140px 120px 120px",
    gap: 8,
    alignItems: "center",
  };

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>管理訂單</h3>
        <div style={{ opacity: 0.8 }}>
          總數量：{totals.qty} ／ 合計：{twd(totals.sum)}
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 12,
          boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ ...row, fontWeight: 700, color: "#333" }}>
          <div>時間</div>
          <div>品項</div>
          <div>下單者</div>
          <div>金額</div>
          <div>已付款</div>
        </div>
        <div style={{ height: 8 }} />
        {orders.map((o) => {
          const who = o.orderedBy?.realName || o.orderedBy?.roleName || "？";
          const at = o.createdAt ? new Date(o.createdAt).toLocaleString() : "-";
          const sum = (o.items || []).reduce(
            (s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0),
            0
          );
          return (
            <div
              key={o.id}
              style={{ ...row, padding: "10px 0", borderTop: "1px solid #f0f0f0" }}
            >
              <div>{at}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {(o.items || [])
                  .map((it) => `${it.name} × ${it.qty}`)
                  .join("， ")}
              </div>
              <div>{who}</div>
              <div>{twd(sum)}</div>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={!!o.paid}
                  onChange={() => togglePaid(o)}
                />
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  {o.paidAt ? new Date(o.paidAt).toLocaleString() : ""}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
