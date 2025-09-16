// src/components/OrdersSummaryTable.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase.js";
import {
  ref as rtdbRef,
  onValue,
  query,
  limitToLast,
  update as rtdbUpdate,
} from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { usePlayer } from "../store/playerContext.jsx";

// 金額（TWD）與數量格式
const ntd1 = (n) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(n) || 0);
const fmtQty = (n) =>
  new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 1 }).format(
    Number(n) || 0
  );

const STATUS_META = {
  ongoing: { label: "開團中", color: "#f59e0b" }, // 黃
  shipped: { label: "已發車", color: "#16a34a" }, // 綠
  ended: { label: "開團結束", color: "#94a3b8" }, // 灰
};

export default function OrdersSummaryTable() {
  const { isAdmin } = usePlayer() || {};
  const [orders, setOrders] = useState([]); // [{ id, createdAt, orderedBy, items[], total, paid, last5 }]
  const [err, setErr] = useState("");

  // ✅ 全局開團資訊（由 AdminPanel 設定）
  const [campaign, setCampaign] = useState({
    status: "ongoing",
    closeAt: null,
    arriveAt: null,
  });
  const [nowTick, setNowTick] = useState(0); // 倒數刷新

  // 訂閱 campaign/current 與每秒 tick
  useEffect(() => {
    const offC = onValue(rtdbRef(db, "campaign/current"), (snap) => {
      const v = snap.val() || {};
      setCampaign({
        status: v.status || "ongoing",
        closeAt: v.closeAt ?? null,
        arriveAt: v.arriveAt ?? null,
      });
    });
    const t = setInterval(() => setNowTick((n) => (n + 1) % 1e9), 1000);
    return () => {
      offC();
      clearInterval(t);
    };
  }, []);

  // 訂閱 orders（需登入：匿名也可）
  useEffect(() => {
    let detachOrders = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // 清除上一個訂閱
      if (detachOrders) {
        detachOrders();
        detachOrders = null;
      }

      if (!user) {
        setOrders([]);
        setErr("尚未登入，無法載入訂單。");
        return;
      }

      setErr("");
      const qOrders = query(rtdbRef(db, "orders"), limitToLast(500));
      detachOrders = onValue(
        qOrders,
        (snap) => {
          const v = snap.val() || {};
          const list = Object.entries(v).map(([id, o]) => {
            // items 可能是 array 或 object，轉成乾淨 array
            const rawItems = o?.items;
            const items = Array.isArray(rawItems)
              ? rawItems.filter(Boolean)
              : rawItems && typeof rawItems === "object"
              ? Object.values(rawItems)
              : [];
            return {
              id,
              createdAt: Number(o?.createdAt || 0),
              orderedBy: o?.orderedBy || {},
              items: items.map((it) => ({
                stallId: String(it?.stallId || ""),
                id: String(it?.id || ""),
                name: String(it?.name || ""),
                price: Number(it?.price || 0),
                qty: Number(it?.qty || 0),
              })),
              total:
                Number(o?.total) ||
                items.reduce(
                  (s, it) =>
                    s + (Number(it.price) || 0) * (Number(it.qty) || 0),
                  0
                ),
              paid: !!o?.paid,
              paidAt: Number(o?.paidAt || 0) || null,
              last5: o?.last5 || null,
            };
          });
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setOrders(list);
        },
        (e) => {
          console.error("[OrdersSummary] read error:", e);
          setOrders([]);
          setErr(e?.code || "讀取失敗，請稍後再試");
        }
      );
    });

    return () => {
      unsubAuth && unsubAuth();
      detachOrders && detachOrders();
    };
  }, []);

  // 所有訂單總金額
  const grandTotal = useMemo(
    () => orders.reduce((s, o) => s + (Number(o.total) || 0), 0),
    [orders]
  );

  // 分攤合計（依攤位彙總）
  const group = useMemo(() => {
    const map = new Map(); // stall -> { items: Map(key -> {name, qty, amount}), sumQty, sumAmount }
    for (const o of orders) {
      for (const it of o.items || []) {
        const stall = String(it.stallId || "未知");
        if (!map.has(stall))
          map.set(stall, {
            stall,
            items: new Map(),
            sumAmount: 0,
            sumQty: 0,
          });
        const bucket = map.get(stall);
        const key = `${it.id}|${it.name}`;
        const qty = Number(it.qty) || 0;
        const price = Number(it.price) || 0;
        const cur = bucket.items.get(key) || { name: it.name, qty: 0, amount: 0 };
        cur.qty += qty;
        cur.amount += qty * price;
        bucket.items.set(key, cur);
        bucket.sumQty += qty;
        bucket.sumAmount += qty * price;
      }
    }
    return Array.from(map.values()).map((b) => ({
      stall: b.stall,
      sumQty: b.sumQty,
      sumAmount: b.sumAmount,
      items: Array.from(b.items.values()),
    }));
  }, [orders]);

  // 勾/取消「已付款」：只 admin 可寫；更新 paid / paidAt / paidBy
  const togglePaid = async (orderId, currentChecked) => {
    if (!isAdmin) return; // UI 雙保險
    const nextPaid = !currentChecked;
    try {
      await rtdbUpdate(rtdbRef(db, `orders/${orderId}`), {
        paid: nextPaid,
        paidAt: nextPaid ? Date.now() : null,
        paidBy: nextPaid ? auth.currentUser?.uid || null : null,
      });
    } catch (e) {
      console.error("[OrdersSummary] update paid failed:", e);
      alert(`更新付款狀態失敗：${e?.message || e}`);
    }
  };

  // 紅色倒數：日:時:分:秒
  const countdown = useMemo(() => {
    const end = Number(campaign.closeAt) || 0;
    if (!end) return { text: "-", done: false };
    const diff = end - Date.now();
    if (diff <= 0) return { text: "已截止", done: true };
    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (x) => String(x).padStart(2, "0");
    return { text: `${d}天:${pad(h)}:${pad(m)}:${pad(sec)}`, done: false };
  }, [campaign.closeAt, nowTick]);

  const statusChip = STATUS_META[campaign.status] || STATUS_META.ongoing;

  return (
    <div
      style={{
        width: "min(1200px,96vw)",
        margin: "0 auto",
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: 16,
        boxShadow: "0 18px 36px rgba(0,0,0,.12)",
        overflow: "hidden",
      }}
    >
      {/* ✅ 顯示全局開團資訊 + 倒數 */}
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid #eee",
          background: "#f9fafb",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>訂單列表</div>
        <span
          style={{
            padding: "2px 10px",
            borderRadius: 999,
            color: "#fff",
            background: statusChip.color,
            fontWeight: 900,
          }}
        >
          {statusChip.label}
        </span>
        <div style={{ color: "#334155" }}>
          收單時間：
          <b>
            {campaign.closeAt
              ? new Date(campaign.closeAt).toLocaleString()
              : "-"}
          </b>
        </div>
        <div style={{ color: "#334155" }}>
          貨到時間：
          <b>
            {campaign.arriveAt
              ? new Date(campaign.arriveAt).toLocaleString()
              : "-"}
          </b>
        </div>
        <div style={{ color: "#b91c1c", fontWeight: 900 }}>
          距離收單還有：{countdown.text}
        </div>
      </div>

      {err && (
        <div style={{ padding: 12, color: "#b91c1c", fontWeight: 700 }}>
          {err === "PERMISSION_DENIED"
            ? "沒有讀取權限：請確認已登入且規則允許讀取 orders。"
            : err}
        </div>
      )}

      {/* 訂單表（總金額為 NT$、已付款可勾選） */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fff7ed" }}>
            <tr>
              <th style={thL}>頭像</th>
              <th style={thL}>角色名稱</th>
              <th style={thL}>訂購清單</th>
              <th style={thR}>總金額（NT$）</th>
              <th style={thC}>已付款</th>
              <th style={thC}>末五碼</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && !err ? (
              <tr>
                <td colSpan={6} style={{ padding: 14, textAlign: "center", color: "#888" }}>
                  目前沒有訂單
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const items = Array.isArray(o.items) ? o.items : [];
                const buyerName =
                  o?.orderedBy?.roleName ||
                  (o?.orderedBy?.uid
                    ? `旅人-${String(o.orderedBy.uid).slice(-5)}`
                    : "旅人");
                const avatarEmoji =
                  { bunny: "🐰", bear: "🐻", cat: "🐱", duck: "🦆" }[
                    o?.orderedBy?.avatar || "bunny"
                  ] || "🙂";

                return (
                  <tr key={o.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={tdL}>
                      <span style={{ fontSize: 22 }}>{avatarEmoji}</span>
                    </td>
                    <td style={tdL}>
                      {buyerName}
                      <div style={{ color: "#94a3b8", fontSize: 12 }}>
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleString()
                          : ""}
                      </div>
                    </td>
                    <td style={tdL}>
                      {items.length === 0 ? (
                        <span style={{ color: "#64748b" }}>（無品項）</span>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {items.map((it, idx) => (
                            <li key={idx}>
                              {it.name} × {fmtQty(it.qty)}（單價 {ntd1(it.price)}）
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td style={tdR}>{ntd1(o.total)}</td>
                    <td style={tdC}>
                      <input
                        type="checkbox"
                        checked={!!o.paid}
                        disabled={!isAdmin}
                        onChange={() => togglePaid(o.id, o.paid)}
                        title={isAdmin ? "核對付款狀態" : "只有管理員可以變更"}
                        style={{ cursor: isAdmin ? "pointer" : "not-allowed" }}
                      />
                      {o.paid && (
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                          {o.paidAt ? new Date(o.paidAt).toLocaleString() : ""}
                        </div>
                      )}
                    </td>
                    <td style={tdC}>{o.last5 || "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...tdL, background: "#fff7ed" }} colSpan={3}>
                所有訂單總金額
              </td>
              <td style={{ ...tdR, background: "#fff7ed" }}>{ntd1(grandTotal)}</td>
              <td style={{ background: "#fff7ed" }} colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 分攤合計：含總數量與總金額（NT$） */}
      <div style={{ borderTop: "1px solid #eee", padding: "12px 16px", fontWeight: 800 }}>
        分攤合計
      </div>
      <div style={{ padding: "0 16px 16px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#eef2ff" }}>
            <tr>
              <th style={thL}>攤位</th>
              <th style={thL}>品項</th>
              <th style={thR}>總數量</th>
              <th style={thR}>總金額（NT$）</th>
            </tr>
          </thead>
          <tbody>
            {group.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 12, textAlign: "center", color: "#888" }}>
                  目前沒有可彙總的品項
                </td>
              </tr>
            ) : (
              group.map((g) => (
                <React.Fragment key={g.stall}>
                  {g.items.length === 0 ? (
                    <tr>
                      <td style={tdL}>{g.stall}</td>
                      <td style={tdL} colSpan={3} />
                    </tr>
                  ) : (
                    g.items.map((it, idx) => (
                      <tr key={`${g.stall}-${idx}`} style={{ borderTop: "1px solid #f1f5f9" }}>
                        {idx === 0 ? (
                          <td style={tdL} rowSpan={g.items.length}>
                            {g.stall}
                          </td>
                        ) : null}
                        <td style={tdL}>{it.name}</td>
                        <td style={tdR}>{fmtQty(it.qty)}</td>
                        <td style={tdR}>{ntd1(it.amount)}</td>
                      </tr>
                    ))
                  )}
                  <tr style={{ background: "#f8fafc" }}>
                    <td style={{ ...tdL, fontWeight: 900 }} colSpan={2}>
                      小計（{g.stall}）
                    </td>
                    <td style={{ ...tdR, fontWeight: 900 }}>{fmtQty(g.sumQty)}</td>
                    <td style={{ ...tdR, fontWeight: 900 }}>{ntd1(g.sumAmount)}</td>
                  </tr>
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thL = { textAlign: "left", padding: 10, fontWeight: 800 };
const thR = { textAlign: "right", padding: 10, fontWeight: 800, width: 160 };
const thC = { textAlign: "center", padding: 10, fontWeight: 800, width: 100 };
const tdL = { textAlign: "left", padding: 10, verticalAlign: "top" };
const tdR = { textAlign: "right", padding: 10, verticalAlign: "top" };
const tdC = { textAlign: "center", padding: 10, verticalAlign: "top" };
