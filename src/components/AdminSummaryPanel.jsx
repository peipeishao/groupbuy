// src/components/AdminSummaryPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { ref as dbRef, onValue, query, limitToLast } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";

/**
 * 分攤合計（僅顯示於團長後台）
 * - 以 /orders 整體資料做彙總
 * - 依「攤位」→「品項」匯總「數量、金額」
 * - 提供快速篩選：僅顯示某個攤位
 */
export default function AdminSummaryPanel() {
  const { isAdmin } = usePlayer() || {};
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState("");
  const [stallFilter, setStallFilter] = useState("all");

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(dbRef(db, "orders"), limitToLast(1000));
    const off = onValue(
      q,
      (snap) => {
        const v = snap.val() || {};
        const list = Object.entries(v).map(([id, o]) => {
          const rawItems = o?.items;
          const items = Array.isArray(rawItems)
            ? rawItems.filter(Boolean)
            : rawItems && typeof rawItems === "object"
            ? Object.values(rawItems)
            : [];
          return {
            id,
            items: items.map((it) => ({
              stallId: String(it?.stallId || "unknown"),
              name: String(it?.name || ""),
              qty: Number(it?.qty || 0),
              price: Number(it?.price || 0),
            })),
            total: Number(o?.total || 0),
          };
        });
        setOrders(list);
      },
      (e) => { console.error("[AdminSummary] read error:", e); setErr(e?.code || "讀取失敗"); }
    );
    return () => off();
  }, [isAdmin]);

  const stallList = useMemo(() => {
    const s = new Set();
    for (const o of orders) for (const it of o.items) s.add(it.stallId || "unknown");
    return Array.from(s);
  }, [orders]);

  const grouped = useMemo(() => {
    const map = new Map(); // stallId -> { items: Map(key->{name,qty,amount}), sumQty, sumAmount }
    for (const o of orders) {
      for (const it of o.items) {
        const stall = String(it.stallId || "unknown");
        if (stallFilter !== "all" && stall !== stallFilter) continue;

        if (!map.has(stall)) map.set(stall, { items: new Map(), sumQty: 0, sumAmount: 0 });

        const key = `${it.name}|${it.price}`;
        const cur = map.get(stall);
        const rec = cur.items.get(key) || { name: it.name, price: it.price, qty: 0, amount: 0 };
        rec.qty += it.qty;
        rec.amount += it.qty * it.price;
        cur.items.set(key, rec);
        cur.sumQty += it.qty;
        cur.sumAmount += it.qty * it.price;
      }
    }
    return Array.from(map, ([stall, bucket]) => ({
      stall,
      sumQty: bucket.sumQty,
      sumAmount: bucket.sumAmount,
      items: Array.from(bucket.items.values()),
    }));
  }, [orders, stallFilter]);

  const totalAll = useMemo(() => grouped.reduce((s, g) => s + g.sumAmount, 0), [grouped]);

  if (!isAdmin) {
    return <div style={wrap}>僅限管理員使用。</div>;
  }

  return (
    <div style={wrap}>
      <div style={head}>
        <div style={{ fontWeight: 900 }}>分攤合計</div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={stallFilter} onChange={(e)=> setStallFilter(e.target.value)} style={sel}>
            <option value="all">全部攤位</option>
            {stallList.map((sid) => <option key={sid} value={sid}>{sid}</option>)}
          </select>
        </div>
      </div>

      {err && <div style={errBox}>{err}</div>}

      {grouped.length === 0 ? (
        <div style={empty}>目前沒有可彙總的資料</div>
      ) : (
        <div style={{ display:"grid", gap:12 }}>
          {grouped.map((g) => (
            <div key={g.stall} style={card}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>攤位：{g.stall}</div>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={thL}>品項</th>
                    <th style={thR}>單價</th>
                    <th style={thR}>總數量</th>
                    <th style={thR}>金額</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((it, i) => (
                    <tr key={i}>
                      <td style={tdL}>{it.name}</td>
                      <td style={tdR}>{formatNTD(it.price)}</td>
                      <td style={tdR}>{formatQty(it.qty)}</td>
                      <td style={tdR}>{formatNTD(it.amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ background:"#f8fafc" }}>
                    <td style={{ ...tdL, fontWeight: 900 }}>小計</td>
                    <td />
                    <td style={{ ...tdR, fontWeight: 900 }}>{formatQty(g.sumQty)}</td>
                    <td style={{ ...tdR, fontWeight: 900 }}>{formatNTD(g.sumAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          <div style={{ ...card, display:"flex", justifyContent:"flex-end" }}>
            <div style={{ fontWeight: 900 }}>全部攤位總金額：{formatNTD(totalAll)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

const wrap = { background:"#fff", border:"1px solid #eee", borderRadius:12, boxShadow:"0 12px 24px rgba(0,0,0,.06)", overflow:"hidden" };
const head = { padding:"10px 12px", borderBottom:"1px solid #eee", background:"#f9fafb", display:"flex", alignItems:"center", justifyContent:"space-between" };
const sel = { padding:"8px 10px", border:"1px solid #ddd", borderRadius:10, background:"#fff" };
const errBox = { padding:12, color:"#b91c1c" };
const empty = { padding:16, color:"#6b7280" };
const card = { border:"1px solid #e5e7eb", borderRadius:12, padding:12, background:"#ffffff" };
const table = { width:"100%", borderCollapse:"collapse" };
const thL = { textAlign:"left", padding:8, borderBottom:"1px solid #f1f5f9" };
const thR = { textAlign:"right", padding:8, borderBottom:"1px solid #f1f5f9", width:120 };
const tdL = { textAlign:"left", padding:8, borderBottom:"1px solid #f8fafc" };
const tdR = { textAlign:"right", padding:8, borderBottom:"1px solid #f8fafc" };

function formatNTD(n){
  return new Intl.NumberFormat("zh-TW", { style:"currency", currency:"TWD", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(n)||0);
}
function formatQty(n){
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 1 }).format(Number(n)||0);
}
