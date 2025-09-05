import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { onValue, ref as dbRef, query, limitToLast } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";

const ntd1 = (n) => new Intl.NumberFormat("zh-TW", { style:"currency", currency:"TWD", minimumFractionDigits:1, maximumFractionDigits:1 }).format(Number(n)||0);

function Modal({ open, onClose, children, title="訂購紀錄" }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:1200, display:"grid", placeItems:"center", padding:12 }}>
      <div onClick={(e)=>e.stopPropagation()} style={{ width:"min(900px,96vw)", background:"#fff", border:"1px solid #eee", borderRadius:16, boxShadow:"0 20px 48px rgba(0,0,0,.2)", overflow:"hidden" }}>
        <div style={{ padding:"8px 14px", background:"#f9fafb", borderBottom:"1px solid #eee", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <b>{title}</b>
          <button onClick={onClose} style={{ padding:"6px 10px", borderRadius:10, border:"1px solid #ddd", background:"#fff" }}>×</button>
        </div>
        <div style={{ maxHeight:"70vh", overflow:"auto", padding:12 }}>{children}</div>
      </div>
    </div>
  );
}

export default function OrderHistoryFab() {
  const { uid } = usePlayer() || {};
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!uid) return;
    const qOrders = query(dbRef(db, "orders"), limitToLast(200));
    const off = onValue(qOrders, (snap) => {
      const v = snap.val() || {};
      const list = Object.entries(v)
        .map(([id, o]) => ({ id, ...(o||{}) }))
        .filter((o) => String(o.uid||"") === String(uid));
      list.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
      setOrders(list);
    });
    return () => off();
  }, [uid]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position:"fixed", right:16, bottom:120, zIndex:1100,
          padding:"10px 14px", borderRadius:999, border:"2px solid #111", background:"#fff", fontWeight:900
        }}
        title="查看我的歷史訂單"
      >
        🧾 訂購紀錄
      </button>

      <Modal open={open} onClose={()=>setOpen(false)}>
        {orders.length === 0 ? (
          <div style={{ color:"#64748b" }}>還沒有訂購紀錄</div>
        ) : (
          <div style={{ display:"grid", gap:10 }}>
            {orders.map((o)=>(
              <div key={o.id} style={{ border:"1px solid #eee", borderRadius:12, padding:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                  <div><b>訂單</b> <span style={{ color:"#94a3b8", fontSize:12 }}>{o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}</span></div>
                  <div style={{ fontWeight:900 }}>{ntd1(o.total||0)}</div>
                </div>
                {Array.isArray(o.items) && o.items.length>0 && (
                  <ul style={{ margin:"6px 0 0", paddingLeft:18 }}>
                    {o.items.map((it, i)=>(
                      <li key={i}>{it.name} × {it.qty}（單價 {ntd1(it.price)}）</li>
                    ))}
                  </ul>
                )}
                <div style={{ fontSize:12, color:"#64748b", marginTop:6 }}>
                  {o.paid ? "已付款" : "未付款"}
                  {o.last5 ? `｜末五碼 ${o.last5}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
