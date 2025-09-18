// src/components/OrdersSummaryTable.jsx — 頭像改用「下單當下」的 orderedBy；保留原功能、狀態著色、日：時：秒倒數與分攤合計
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
import OrderAvatar from "./common/OrderAvatar.jsx";

/* 你可在這裡微調「攤位名稱」樣式（用攤位 ID 對應） */
const STALL_TITLE_STYLE = {
  chicken: { color: "#b16722ff", fontSize: 22, fontWeight: 900 }, // 雞胸肉
  cannele: { color: "#f06d16ff", fontSize: 20, fontWeight: 800 }, // C文可麗露
};
// 預設樣式（沒有在上面列出的攤位會用這個）
const DEFAULT_TITLE_STYLE = { fontSize: 18, fontWeight: 800 };

/* 狀態→顯示文字與顏色（你的規格） */
const STATUS_META = {
  ongoing:  { label: "開團中",   color: "#ef4444" }, // 紅
  shipped:  { label: "開團成功", color: "#16a34a" }, // 綠
  ended:    { label: "開團結束", color: "#9ca3af" }, // 灰
  upcoming: { label: "尚未開始", color: "#3b82f6" }, // 藍（補齊）
};

/* 金額與數量格式 */
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

/* 將剩餘時間格式化為「日：時：秒」 */
function formatRemainDHS(closeAtMs, nowMs) {
  const end = Number(closeAtMs) || 0;
  if (!end) return "-";
  const diff = end - nowMs;
  if (diff <= 0) return "已截止";
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const sec = s % 60;
  const pad = (x) => String(x).padStart(2, "0");
  // 依你的需求以「日：時：秒」顯示（無分）
  return `${d}日：${pad(h)}時：${pad(sec)}秒`;
}

/** 訂閱所有攤位的 campaign，並依 startAt/closeAt 自動推導狀態 */
function useStallCampaigns() {
  const [stalls, setStalls] = useState([]); // [{id,title,campaign:{...}}]
  const [, forceTick] = useState(0);

  useEffect(() => {
    const off = onValue(rtdbRef(db, "stalls"), (snap) => {
      const v = snap.val() || {};
      const arr = Object.entries(v).map(([id, s]) => ({
        id,
        title: String(s?.title || id),
        campaign: s?.campaign || null,
      }));
      setStalls(arr);
    });

    // 每秒刷新一次，讓倒數/狀態自動變
    const t = setInterval(() => {
      forceTick((x) => (x + 1) % 1e9);
    }, 1000);

    return () => { off(); clearInterval(t); };
  }, []);

  const now = Date.now();

  // 依時間推導「顯示用狀態」
  const computeStatus = (rawStatus, startAt, closeAt) => {
    const s = String(rawStatus || "").trim();

    // 若後台標記 shipped，直接使用（優先）
    if (s === "shipped") return "shipped";

    const hasStart = typeof startAt === "number" && startAt > 0;
    const hasClose = typeof closeAt === "number" && closeAt > 0;

    if (hasStart && now < startAt) return "upcoming";
    if (hasClose && now >= closeAt) return "ended";

    // 其他情況預設 ongoing；若後台硬指定 ended/upcoming 也會在上面兩行被覆蓋
    return "ongoing";
  };

  return stalls.map((s) => {
    const c = s.campaign || {};
    const startAt = c.startAt ? Number(c.startAt) : null;
    const closeAt = c.closeAt ? Number(c.closeAt) : null;
    const arriveAt = c.arriveAt ? Number(c.arriveAt) : null;

    const status = computeStatus(c.status, startAt, closeAt);

    const remain =
      status === "upcoming"
        ? "尚未開始"
        : formatRemainDHS(closeAt, now); // 你的 formatRemainDHS 會處理已截止顯示

    return {
      id: s.id,
      title: s.title,
      status,     // ✅ 用推導後的狀態
      startAt,
      closeAt,
      arriveAt,
      upcoming: status === "upcoming",
      ended: status === "ended",
      remain,
    };
  });
}


export default function OrdersSummaryTable() {
  const { isAdmin } = usePlayer() || {};
  const [orders, setOrders] = useState([]); // [{ id, createdAt, orderedBy, items[], total, paid, last5 }]
  const [err, setErr] = useState("");

  // 每攤 campaign 資訊（頂部顯示用）
  const stallInfo = useStallCampaigns();

  // 訂閱 orders（需登入：匿名也可）
  useEffect(() => {
    let detachOrders = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (detachOrders) { detachOrders(); detachOrders = null; }
      if (!user) { setOrders([]); setErr("尚未登入，無法載入訂單。"); return; }

      setErr("");
      const qOrders = query(rtdbRef(db, "orders"), limitToLast(500));
      detachOrders = onValue(
        qOrders,
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

    return () => { unsubAuth && unsubAuth(); detachOrders && detachOrders(); };
  }, []);

  // 所有訂單總金額
  const grandTotal = useMemo(
    () => orders.reduce((s, o) => s + (Number(o.total) || 0), 0),
    [orders]
  );

  // 分攤合計（依攤位彙總）
  const group = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      for (const it of o.items || []) {
        const stall = String(it.stallId || "未知");
        if (!map.has(stall))
          map.set(stall, { stall, items: new Map(), sumAmount: 0, sumQty: 0 });
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

  // 勾/取消「已付款」
  const togglePaid = async (orderId, currentChecked) => {
    if (!isAdmin) return;
    const nextPaid = !currentChecked;
    try {
      await rtdbUpdate(rtdbRef(db, `orders/${orderId}`), {
        paid: nextPaid,
        paidAt: nextPaid ? Date.now() : null,
      });
    } catch (e) {
      console.error("[OrdersSummary] update paid failed:", e);
      alert(`更新付款狀態失敗：${e?.message || e}`);
    }
  };

  // ── UI ────────────────────────────────────────────────
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
      {/* 頂部：每攤位一行（狀態著色、距離收單還有＝日：時：秒） */}
      <div style={{ padding: 12, borderBottom: "1px solid #eee", background: "#f8fafc" }}>
        {stallInfo.length === 0 ? (
          <div style={{ color:"#64748b" }}>尚未建立任何攤位或尚無開團設定。</div>
        ) : (
          <div style={{ display:"grid", gap:6 }}>
            {stallInfo
              .sort((a,b)=> String(a.title).localeCompare(String(b.title)))
              .map((s) => {
                const meta = STATUS_META[s.status] || { label: s.status, color: "#64748b" };
                const closeText  = s.closeAt  ? new Date(s.closeAt).toLocaleString()  : "-";
                const arriveText = s.arriveAt ? new Date(s.arriveAt).toLocaleString() : "-";
                return (
                  <div key={s.id} style={{ fontSize: 14, color: "#0f172a" }}>
                    {/* 攤位名稱（可自訂樣式） */}
                    <span style={STALL_TITLE_STYLE[s.id] || DEFAULT_TITLE_STYLE}>
                      {s.title}
                    </span>
                    {/* 狀態：依規格上色 */}
                    <span style={{ marginLeft: 8, color: meta.color, fontWeight: 900 }}>
                      {`<${meta.label}>`}
                    </span>
                    {/* 收單/到貨/倒數（倒數改為 日：時：秒） */}
                    <span style={{ marginLeft: 12 }}>收單時間：<b>{closeText}</b></span>
                    <span style={{ marginLeft: 12 }}>貨到時間：<b>{arriveText}</b></span>
                    <span style={{ marginLeft: 12 }}>
                      距離收單還有：<b style={{ color: "#b91c1c" }}>{s.remain}</b>
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

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
                const ob = o?.orderedBy || {};
                const buyerName =
                  ob.roleName ||
                  (ob.uid ? `旅人-${String(ob.uid).slice(-5)}` : "旅人");

                return (
                  <tr key={o.id}>
                    {/* ✅ 頭像：使用「下單當下」的 avatarUrl / avatar */}
                    <td style={tdC}>
                      <OrderAvatar order={o} size={32} />
                    </td>

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

      {/* 分攤合計 */}
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
