// src/components/OrdersSummaryTable.jsx — 管理端：有折扣欄位才顯示三行；頁尾加顯折後總額
import React, { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase.js";
import { ref as rtdbRef, onValue, query, limitToLast, update as rtdbUpdate } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { usePlayer } from "../store/playerContext.jsx";
import OrderAvatar from "./common/OrderAvatar.jsx";

// ⬇️ 金額格式
import { ntd1 } from "../utils/pricing.js";

const fmtQty = (n) => new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 1 }).format(Number(n) || 0);

export default function OrdersSummaryTable({ fixedWidth = "min(1100px, 96vw)", fixedHeight = "480px" }) {
  const { isAdmin } = usePlayer() || {};
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let detachOrders = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (detachOrders) { detachOrders(); detachOrders = null; }
      if (!user) { setOrders([]); setErr("尚未登入，無法載入訂單。"); return; }

      setErr("");
      const qOrders = query(rtdbRef(db, "orders"), limitToLast(500));
      detachOrders = onValue(qOrders, (snap) => {
        const v = snap.val() || {};
        const list = Object.entries(v).map(([id, o]) => {
          const rawItems = o?.items;
          const items = Array.isArray(rawItems)
            ? rawItems.filter(Boolean)
            : rawItems && typeof rawItems === "object"
            ? Object.values(rawItems)
            : [];

          const subtotal =
            typeof o?.subtotal === "number"
              ? Number(o.subtotal)
              : items.reduce((s, it) => s + (Number(it?.price) || 0) * (Number(it?.qty) || 0), 0);
          const discount = typeof o?.discount === "number" ? Number(o.discount) : 0;
          const totalAfterDiscount =
            typeof o?.totalAfterDiscount === "number"
              ? Number(o.totalAfterDiscount)
              : Math.max(0, subtotal - discount);

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
              items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0),

            subtotal,
            discount,
            totalAfterDiscount,
            discountMeta: o?.discountMeta || null,

            paid: !!o?.paid,
            paidAt: Number(o?.paidAt || 0) || null,
            last5: o?.last5 || null,
          };
        });
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setOrders(list);
      }, (e) => {
        console.error("[OrdersSummary] read error:", e);
        setOrders([]);
        setErr(e?.code || "讀取失敗，請稍後再試");
      });
    });

    return () => { unsubAuth && unsubAuth(); detachOrders && detachOrders(); };
  }, []);

  useEffect(() => {
    const off = onValue(rtdbRef(db, "announcements/ordersSummary"), (snap) => {
      const v = snap.val();
      const t = (v && typeof v.text === "string") ? v.text.trim() : "";
      setNotice(t);
    }, () => setNotice(""));
    return () => off();
  }, []);

  const grandTotal = useMemo(() => orders.reduce((s, o) => s + (Number(o.total) || 0), 0), [orders]);
  const hasAnyDiscount = useMemo(
    () => orders.some((o) =>
      typeof o?.discount === "number" ||
      (o?.discountMeta && o.discountMeta?.perItem)
    ),
    [orders]
  );
  const grandPayable = useMemo(
    () => orders.reduce((s, o) => s + (Number(o.totalAfterDiscount ?? Math.max(0, (o.subtotal||0) - (o.discount||0))) || 0), 0),
    [orders]
  );

  const togglePaid = async (orderId, currentChecked) => {
    if (!isAdmin) return;
    const nextPaid = !currentChecked;
    try {
      await rtdbUpdate(rtdbRef(db, `orders/${orderId}`), { paid: nextPaid, paidAt: nextPaid ? Date.now() : null });
    } catch (e) {
      console.error("[OrdersSummary] update failed:", e);
      alert(`更新付款狀態失敗：${e?.message || e}`);
    }
  };

  return (
    <div style={{
      width: fixedWidth,
      height: fixedHeight,
      margin: "0 auto",
      background: "#fff",
      border: "1px solid #eee",
      borderRadius: 16,
      boxShadow: "0 18px 36px rgba(0,0,0,.12)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {notice ? (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px",
          background: "#fff1c6", borderBottom: "1px solid #facc15", fontWeight: 700, color: "#4b5563",
        }} title="公告">
          <span style={{ fontSize: 18, lineHeight: "1.2em" }} role="img" aria-label="megaphone">📣</span>
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{notice}</div>
        </div>
      ) : null}

      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ position: "sticky", top: 0, background: "#fff7ed", zIndex: 1 }}>
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
              <tr><td colSpan={6} style={{ padding: 14, textAlign: "center", color: "#888" }}>目前沒有訂單</td></tr>
            ) : (
              orders.map((o) => {
                const items = Array.isArray(o.items) ? o.items : [];
                const ob = o?.orderedBy || {};
                const buyerName = ob.roleName || (ob.uid ? `旅人-${String(ob.uid).slice(-5)}` : "旅人");

                const showDiscount =
                  typeof o?.subtotal === "number" ||
                  typeof o?.discount === "number" ||
                  typeof o?.totalAfterDiscount === "number" ||
                  (o?.discountMeta && o.discountMeta?.perItem);

                return (
                  <tr key={o.id}>
                    <td style={tdC}><OrderAvatar order={o} size={32} /></td>
                    <td style={tdL}>
                      {buyerName}
                      <div style={{ color: "#94a3b8", fontSize: 12 }}>
                        {o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}
                      </div>
                    </td>
                    <td style={tdL}>
                      {items.length === 0 ? (
                        <span style={{ color: "#64748b" }}>（無品項）</span>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {items.map((it, idx) => (
                            <li key={idx}>{it.name} × {fmtQty(it.qty)}（單價 {ntd1(it.price)}）</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td style={tdR}>
                      <div style={{ fontWeight: 800 }}>{ntd1(o.total)}</div>
                      {showDiscount && (
                        <div style={{ marginTop: 4, fontSize: 12, color: "#1f2937" }}>
                          <div>小計 {ntd1(o.subtotal ?? o.total)}</div>
                          <div style={{ color: "#16a34a", fontWeight: 700 }}>折扣 − {ntd1(o.discount ?? 0)}</div>
                          <div style={{ color: "#111827", fontWeight: 900 }}>
                            折後 {ntd1(o.totalAfterDiscount ?? Math.max(0, (o.subtotal||0) - (o.discount||0)))}
                          </div>
                        </div>
                      )}
                    </td>
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
          <tfoot style={{ position: "sticky", bottom: 0, background: "#fff7ed" }}>
            <tr>
              <td style={{ ...tdL, background: "transparent" }} colSpan={3}>所有訂單總金額</td>
              <td style={{ ...tdR, background: "transparent" }}>{ntd1(grandTotal)}</td>
              <td style={{ background: "transparent" }} colSpan={2} />
            </tr>
            {hasAnyDiscount && (
              <tr>
                <td style={{ ...tdL, background: "transparent" }} colSpan={3}>折扣後總額總計</td>
                <td style={{ ...tdR, background: "transparent", fontWeight: 900 }}>{ntd1(grandPayable)}</td>
                <td style={{ background: "transparent" }} colSpan={2} />
              </tr>
            )}
          </tfoot>
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
