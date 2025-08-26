// src/components/OrderForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ref, push, onValue } from "firebase/database";
import { db } from "../firebase";
import { useDanmu } from "./danmuHook";

/* 商品清單（左為平價，右為奢華） */
const PRODUCTS = [
  // left (平價 100g/包)
  { id: "p1", name: "經典蒜辣雞Q丸", original:65, price: 65*0.74, category:"平價" },
  { id: "p2", name: "經典薑蔥雞Q丸", original:65, price: 65*0.74, category:"平價" },
  { id: "p3", name: "經典蒜鹽嫩雞胸(A)", original:55, price: 55*0.74, category:"平價" },
  { id: "p4", name: "經典香草嫩雞胸(B)", original:55, price: 55*0.74, category:"平價" },
  { id: "p5", name: "經典香滷嫩雞胸(C)", original:55, price: 55*0.74, category:"平價" },
  { id: "p6", name: "經典椒麻嫩雞胸(D)", original:55, price: 55*0.74, category:"平價" },
  { id: "p7", name: "經典鹽麴嫩雞胸(E)", original:55, price: 55*0.74, category:"平價" },

  // right (奢華 160g/包)
  { id: "q1", name: "青辣椒花生醬G胸肉(短效-2025/10/23)", original:50, price:50, category:"奢華" },
  { id: "q2", name: "剝皮辣椒G胸肉", original:111, price:111, category:"奢華" },
  { id: "q3", name: "胡桃木香燻G胸肉", original:111, price:111, category:"奢華" },
  { id: "q4", name: "青檸紅藜G胸肉", original:111, price:111, category:"奢華" },
  { id: "q5", name: "翠玉蔥油即食G胸肉", original:111, price:111, category:"奢華" },
  { id: "q6", name: "紐澳良辣G胸肉", original:111, price:111, category:"奢華" },
  { id: "q7", name: "迷迭香G胸肉", original:111, price:111, category:"奢華" },
  { id: "q8", name: "川味椒麻G胸肉", original:111, price:111, category:"奢華" },
];

export default function OrderForm({ DEADLINE }) {
  const [orders, setOrders] = useState([]);
  const [quantities, setQuantities] = useState(() => Object.fromEntries(PRODUCTS.map(p=>[p.id,0])));
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const addDanmu = useDanmu();

  // Realtime listen orders
  useEffect(()=>{
    const ordersRef = ref(db, "orders");
    return onValue(ordersRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, data]) => ({ id, ...data }));
      // sort by createdAt desc
      arr.sort((a,b)=> b.createdAt - a.createdAt);
      setOrders(arr);
    });
  }, []);

  // 計算每項已訂購總數
  const orderedCount = useMemo(()=>{
    const map = Object.fromEntries(PRODUCTS.map(p=>[p.id,0]));
    for(const o of orders){
      for(const it of o.items||[]){
        map[it.id] = (map[it.id]||0) + (it.qty||0);
      }
    }
    return map;
  }, [orders]);

  // 剩餘量 (假設stock 999為無上限，或你可以改stock)
  const stockDefault = 999;
  const remaining = useMemo(()=>{
    const r = {};
    for(const p of PRODUCTS){
      r[p.id] = Math.max(0, stockDefault - (orderedCount[p.id] || 0));
    }
    return r;
  }, [orderedCount]);

  function changeQty(id, delta){
    setQuantities(q=> {
      const cur = q[id] || 0;
      const next = Math.max(0, Math.min(remaining[id], cur + delta));
      return {...q, [id]: next};
    });
  }
  function setQty(id, value){
    setQuantities(q=> ({...q, [id]: Math.max(0, Math.min(remaining[id], Math.floor(Number(value)||0)))}));
  }

  function formatCurrency(n){ return new Intl.NumberFormat("zh-TW",{style:"currency",currency:"TWD",maximumFractionDigits:0}).format(n); }

  const cart = useMemo(()=> {
    return PRODUCTS.map(p=>({...p, qty: quantities[p.id]||0})).filter(x=>x.qty>0);
  }, [quantities]);

  const total = useMemo(()=> cart.reduce((s,it)=> s + it.price * it.qty, 0), [cart]);

  // submit: push to Firebase, 每筆order包含 items陣列
  async function handleSubmit(e){
    e?.preventDefault();
    if(new Date() > DEADLINE) return alert("已過截止，無法下單");
    if(!name.trim()||!contact.trim()) return alert("請填寫姓名與聯絡方式");
    if(cart.length===0) return alert("請選擇至少一項商品");

    const orderObj = {
      name: name.trim(),
      contact: contact.trim(),
      note: note.trim(),
      items: cart.map(c=>({id:c.id,name:c.name,qty:c.qty,price:c.price})),
      total,
      createdAt: Date.now()
    };
    // push
    const newRef = await push(ref(db, "orders"), orderObj);

    // 生成下單彈幕：每個品項都發一則紅色彈幕
    for(const it of orderObj.items){
      addDanmu(`${orderObj.name} 剛下單 ${it.name} x${it.qty}！`, "order");
    }

    // reset
    setQuantities(Object.fromEntries(PRODUCTS.map(p=>[p.id,0])));
    setName(""); setContact(""); setNote("");
  }

  return (
    <div className="card">
      <h2>商品列表 & 下單（左：平價，右：奢華）</h2>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12}}>
        {/* 左 column (平價) */}
        <div className="product-list">
          <h3>平價雞胸肉 - 金豐盛 (100g/包)</h3>
          {PRODUCTS.filter(p=>p.category==="平價").map(p=>(
            <div key={p.id} className="product">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700}}>{p.name}</div>
                  <div style={{fontSize:12,color:"#64748b"}}>原價 {p.original} / 折扣價 {formatCurrency(p.price)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:12}}>已訂：{orderedCount[p.id]||0}</div>
                  <div style={{fontSize:12}}>剩餘：{remaining[p.id]}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button className="small-btn" onClick={()=>changeQty(p.id,-1)} disabled={(quantities[p.id]||0)<=0}>-</button>
                <input className="input" style={{width:80,textAlign:"center"}} type="number" value={quantities[p.id]||""} onChange={e=>setQty(p.id,e.target.value)} />
                <button className="small-btn" onClick={()=>changeQty(p.id,1)} disabled={(quantities[p.id]||0)>=remaining[p.id]}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Right column (奢華) */}
        <div className="product-list">
          <h3>奢華雞胸肉 - 台畜 (160g/包)</h3>
          {PRODUCTS.filter(p=>p.category==="奢華").map(p=>(
            <div key={p.id} className="product">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700}}>{p.name}</div>
                  <div style={{fontSize:12,color:"#64748b"}}>價格 {formatCurrency(p.price)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:12}}>已訂：{orderedCount[p.id]||0}</div>
                  <div style={{fontSize:12}}>剩餘：{remaining[p.id]}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button className="small-btn" onClick={()=>changeQty(p.id,-1)} disabled={(quantities[p.id]||0)<=0}>-</button>
                <input className="input" style={{width:80,textAlign:"center"}} type="number" value={quantities[p.id]||""} onChange={e=>setQty(p.id,e.target.value)} />
                <button className="small-btn" onClick={()=>changeQty(p.id,1)} disabled={(quantities[p.id]||0)>=remaining[p.id]}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 下方表單 */}
      <form onSubmit={handleSubmit} style={{marginTop:12, display:"grid", gap:8}}>
        <div style={{display:"flex", gap:8}}>
          <input className="input" placeholder="姓名" value={name} onChange={e=>setName(e.target.value)} />
          <input className="input" placeholder="聯絡方式" value={contact} onChange={e=>setContact(e.target.value)} />
        </div>
        <textarea className="input" placeholder="備註 (口味/過敏/取貨資訊)" value={note} onChange={e=>setNote(e.target.value)} />
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div>總計： <strong>{formatCurrency(total)}</strong></div>
          <div>
            <button type="button" className="button" style={{marginRight:8}} onClick={()=>{ setQuantities(Object.fromEntries(PRODUCTS.map(p=>[p.id,0]))); }}>清空購物車</button>
            <button type="submit" className="button">送出訂單</button>
          </div>
        </div>
      </form>
    </div>
  );
}

