// src/components/OrdersList.jsx
import React, { useEffect, useState } from "react";
import { ref, onValue, remove } from "firebase/database";
import { db } from "../firebase";

export default function OrdersList(){
  const [orders, setOrders] = useState([]);

  useEffect(()=>{
    const ordersRef = ref(db, "orders");
    return onValue(ordersRef, snap=>{
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, data]) => ({ id, ...data }));
      arr.sort((a,b)=> b.createdAt - a.createdAt);
      setOrders(arr);
    });
  }, []);

  const totalAmount = orders.reduce((sum,o) => sum + (o.total||0), 0);

  async function handleDelete(orderId){
    const ok = window.confirm("確定要刪除此訂單？刪除後會從伺服器移除，無法復原。");
    if(!ok) return;
    try{
      await remove(ref(db, `orders/${orderId}`));
      // onValue 會自動更新 local state
    }catch(err){
      console.error(err);
      alert("刪除失敗，請稍後再試");
    }
  }

  function formatCurrency(n){ return new Intl.NumberFormat("zh-TW",{style:"currency",currency:"TWD",maximumFractionDigits:0}).format(n); }

  return (
    <div className="card">
      <h3>團長後台統計</h3>
      <div style={{marginTop:8}}>
        <div>總訂單數：{orders.length}</div>
        <div style={{marginTop:6}}>總金額： <strong>{formatCurrency(totalAmount)}</strong></div>
      </div>

      <div style={{marginTop:12}}>
        {orders.map(o => (
          <div key={o.id} style={{borderTop:"1px solid #eef2f7", paddingTop:8, marginTop:8}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <div>
                <div style={{fontWeight:700}}>{o.name} <span style={{fontWeight:400, color:"#64748b"}}>({o.contact})</span></div>
                <div style={{fontSize:12,color:"#94a3b8"}}>{new Date(o.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <button className="small-btn" onClick={()=>handleDelete(o.id)}>刪除</button>
              </div>
            </div>
            <ul style={{marginTop:8}}>
              {o.items?.map((it, idx)=> <li key={idx}>{it.name} x {it.qty} = {formatCurrency(it.qty * it.price)}</li>)}
            </ul>
            <div style={{marginTop:6,fontWeight:700}}>應付：{formatCurrency(o.total)}</div>
          </div>
        ))}
        {orders.length===0 && <div style={{color:"#64748b"}}>尚無訂單</div>}
      </div>
    </div>
  );
}
