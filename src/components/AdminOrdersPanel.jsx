// src/components/AdminOrdersPanel.jsx — 可刪除訂單＋顯示真實姓名（含 playersPrivate 回補）
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase.js";
import { onValue, ref, update, remove, get } from "firebase/database";

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
  const [realNames, setRealNames] = useState({}); // { uid: realName }
  const loadingReal = useRef(new Set()); // 避免同 uid 重複抓

  useEffect(() => {
    const off = onValue(ref(db, "orders"), (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([id, o]) => ({ id, ...o }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOrders(list);
    });
    return () => off();
  }, []);

  // 若某筆訂單缺 realName，就動態回補 playersPrivate/{uid}/realName
  useEffect(() => {
    const need = new Set(
      orders
        .filter(o => !o?.orderedBy?.realName && o?.uid)
        .map(o => String(o.uid))
    );
    need.forEach(async (u) => {
      if (loadingReal.current.has(u) || realNames[u]) return;
      loadingReal.current.add(u);
      try {
        const snap = await get(ref(db, `playersPrivate/${u}/realName`));
        const rn = String(snap.val() || "");
        if (rn) setRealNames(prev => ({ ...prev, [u]: rn }));
      } catch {}
      finally { /* do nothing */ }
    });
  }, [orders, realNames]);

  const totals = useMemo(() => {
    let qty = 0, sum = 0;
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

  async function deleteOrder(o) {
    if (!window.confirm(`確定刪除這筆訂單？\n下單者：${o?.orderedBy?.roleName || "（未知）"}\n金額：${twd((o.items||[]).reduce((s,i)=>s+(Number(i.price)||0)*(Number(i.qty)||0),0))}`)) {
      return;
    }
    try {
      await remove(ref(db, `orders/${o.id}`));
    } catch (e) {
      console.error("[AdminOrders] delete failed", e);
      alert("刪除失敗，請稍後再試");
    }
  }

  const row = {
    display: "grid",
    gridTemplateColumns: "150px 1fr 200px 120px 120px 100px",
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
          <div>下單者（真實姓名）</div>
          <div>金額</div>
          <div>已付款</div>
          <div>操作</div>
        </div>
        <div style={{ height: 8 }} />
        {orders.map((o) => {
          const at = o.createdAt ? new Date(o.createdAt).toLocaleString() : "-";
          const sum = (o.items || []).reduce(
            (s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0),
            0
          );
          const rn = o?.orderedBy?.realName || realNames[o?.uid] || "";
          const who = `${rn ? rn + "／" : ""}${o?.orderedBy?.roleName || "？"}`;

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
              <div>
                <button
                  onClick={() => deleteOrder(o)}
                  style={{ padding: "6px 10px", borderRadius: 10, border: "2px solid #ef4444", background: "#fff", color: "#ef4444", fontWeight: 800, cursor: "pointer" }}
                  title="刪除訂單"
                >
                  刪除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
