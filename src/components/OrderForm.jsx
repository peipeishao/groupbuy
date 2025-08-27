// src/components/OrderForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, onValue } from "firebase/database";

// Check for the global Firebase config variable provided by the environment
// If not available, use a placeholder to prevent errors.
const firebaseConfig = typeof __firebase_config !== "undefined"
  ? JSON.parse(__firebase_config)
  : {};

// Initialize Firebase only once
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default function OrderForm({ DEADLINE }) {
  const [products, setProducts] = useState([]); // 從 Firebase 動態載入的商品清單
  const [orders, setOrders] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  // const addDanmu = useDanmu(); // Temporarily removed to fix the error

  // 1. 從 Firebase 載入商品清單
  useEffect(() => {
    const productsRef = ref(db, "products");
    const unsubscribe = onValue(productsRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, data]) => ({ id, ...data }));
      setProducts(arr);
      // 更新 quantities 狀態以反映新的商品清單
      setQuantities(q => {
        const newQuantities = {};
        for(const p of arr) {
          newQuantities[p.id] = q[p.id] || 0;
        }
        return newQuantities;
      });
    });
    return () => unsubscribe();
  }, []);

  // 2. 從 Firebase 即時監聽訂單
  useEffect(()=>{
    const ordersRef = ref(db, "orders");
    const unsubscribe = onValue(ordersRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, data]) => ({ id, ...data }));
      // sort by createdAt desc
      arr.sort((a,b)=> b.createdAt - a.createdAt);
      setOrders(arr);
    });
    return () => unsubscribe();
  }, []);

  // 3. 計算每項已訂購總數
  const orderedCount = useMemo(()=>{
    const map = Object.fromEntries(products.map(p=>[p.id,0]));
    for(const o of orders){
      for(const it of o.items||[]){
        map[it.id] = (map[it.id]||0) + (it.qty||0);
      }
    }
    return map;
  }, [orders, products]);

  // 4. 剩餘量
  const stockDefault = 999;
  const remaining = useMemo(()=>{
    const r = {};
    for(const p of products){
      r[p.id] = Math.max(0, stockDefault - (orderedCount[p.id] || 0));
    }
    return r;
  }, [orderedCount, products]);

  // 5. 處理數量變更
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

  // 6. 格式化價格
  function formatCurrency(n){ return new Intl.NumberFormat("zh-TW",{style:"currency",currency:"TWD",maximumFractionDigits:0}).format(n); }

  // 7. 計算購物車總價
  const cart = useMemo(()=> {
    return products.map(p=>({...p, qty: quantities[p.id]||0})).filter(x=>x.qty>0);
  }, [quantities, products]);

  const total = useMemo(()=> cart.reduce((s,it)=> s + it.price * it.qty, 0), [cart]);

  // 8. 送出訂單
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
    await push(ref(db, "orders"), orderObj);

    // Temporarily removed the call to addDanmu
    // for(const it of orderObj.items){
    //   addDanmu(`${orderObj.name} 剛下單 ${it.name} x${it.qty}！`, "order");
    // }

    setQuantities({});
    setName(""); setContact(""); setNote("");
  }

  // 9. 渲染 UI
  const leftProducts = products.filter(p => p.category === "平價");
  const rightProducts = products.filter(p => p.category === "奢華");

  return (
    <div className="card">
      <h2>商品列表 & 下單（左：平價，右：奢華）</h2>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12}}>
        {/* 左 column (平價) */}
        <div className="product-list">
          <h3>平價雞胸肉 - 金豐盛 (100g/包)</h3>
          {leftProducts.map(p => (
            <div key={p.id} className="product">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700}}>{p.name}</div>
                  <div style={{fontSize:12,color:"#64748b"}}>原價 {p.original} / 折扣價 {formatCurrency(p.price)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:12}}>已訂：{orderedCount[p.id] || 0}</div>
                  <div style={{fontSize:12}}>剩餘：{remaining[p.id]}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button className="small-btn" onClick={() => changeQty(p.id, -1)} disabled={(quantities[p.id] || 0) <= 0}>-</button>
                <input className="input" style={{width:80,textAlign:"center"}} type="number" value={quantities[p.id] || ""} onChange={e => setQty(p.id, e.target.value)} />
                <button className="small-btn" onClick={() => changeQty(p.id, 1)} disabled={(quantities[p.id] || 0) >= remaining[p.id]}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Right column (奢華) */}
        <div className="product-list">
          <h3>奢華雞胸肉 - 台畜 (160g/包)</h3>
          {rightProducts.map(p => (
            <div key={p.id} className="product">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700}}>{p.name}</div>
                  <div style={{fontSize:12,color:"#64748b"}}>價格 {formatCurrency(p.price)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:12}}>已訂：{orderedCount[p.id] || 0}</div>
                  <div style={{fontSize:12}}>剩餘：{remaining[p.id]}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button className="small-btn" onClick={() => changeQty(p.id, -1)} disabled={(quantities[p.id] || 0) <= 0}>-</button>
                <input className="input" style={{width:80,textAlign:"center"}} type="number" value={quantities[p.id] || ""} onChange={e => setQty(p.id, e.target.value)} />
                <button className="small-btn" onClick={() => changeQty(p.id, 1)} disabled={(quantities[p.id] || 0) >= remaining[p.id]}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 下方表單 */}
      <form onSubmit={handleSubmit} style={{marginTop:12, display:"grid", gap:8}}>
        <div style={{display:"flex", gap:8}}>
          <input className="input" placeholder="姓名" value={name} onChange={e => setName(e.target.value)} />
          <input className="input" placeholder="聯絡方式" value={contact} onChange={e => setContact(e.target.value)} />
        </div>
        <textarea className="input" placeholder="備註 (口味/過敏/取貨資訊)" value={note} onChange={e => setNote(e.target.value)} />
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div>總計： <strong>{formatCurrency(total)}</strong></div>
          <div>
            <button type="button" className="button" style={{marginRight:8}} onClick={() => { setQuantities({}); }}>清空購物車</button>
            <button type="submit" className="button">送出訂單</button>
          </div>
        </div>
      </form>
    </div>
  );
}
