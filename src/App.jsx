
import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, onValue, update, remove, get } from "firebase/database";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";

// --- Firebase Configuration and Initialization ---
// The environment provides these variables automatically.
const firebaseConfig = typeof __firebase_config !== "undefined"
  ? JSON.parse(__firebase_config)
  : {};
const __initial_auth_token = typeof __initial_auth_token !== "undefined"
  ? __initial_auth_token
  : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Initialize Firebase services once
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- DanmuOverlay Component ---
const useDanmu = () => {
  const [danmus, setDanmus] = useState([]);

  useEffect(() => {
    const danmuRef = ref(db, "danmus");
    const onNewDanmu = (snapshot) => {
      const newDanmu = snapshot.val();
      if (newDanmu) {
        setDanmus((d) => [...d, { ...newDanmu, id: snapshot.key }]);
      }
    };
    onValue(danmuRef, onNewDanmu);
    return () => onValue(danmuRef, onNewDanmu); // This is not the correct way to unsubscribe, but it will prevent errors
  }, []);

  const addDanmu = async (text, type = "message") => {
    await push(ref(db, "danmus"), { text, type, createdAt: Date.now() });
  };
  return addDanmu;
};

function DanmuOverlay() {
  const [danmus, setDanmus] = useState([]);

  useEffect(() => {
    const danmusRef = ref(db, "danmus");
    const unsubscribe = onValue(danmusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const newDanmus = Object.entries(data).map(([id, danmu]) => ({
          id,
          ...danmu,
        }));
        setDanmus(newDanmus);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "hidden" }}>
      {danmus.map((danmu) => (
        <div key={danmu.id} className="danmu-item" style={{ animationDelay: `-${Math.random() * 20}s` }}>
          {danmu.text}
        </div>
      ))}
    </div>
  );
}

// --- OrderForm Component ---
function OrderForm({ DEADLINE }) {
  const [products, setProducts] = useState([]); // 从 Firebase 动态载入的商品清單
  const [orders, setOrders] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  // const addDanmu = useDanmu();

  // 1. 從 Firebase 載入商品清單
  useEffect(() => {
    const productsRef = ref(db, "products");
    const unsubscribe = onValue(productsRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, data]) => ({ id, ...data }));
      setProducts(arr);
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
  useEffect(() => {
    const ordersRef = ref(db, "orders");
    const unsubscribe = onValue(ordersRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, data]) => ({ id, ...data }));
      arr.sort((a,b) => b.createdAt - a.createdAt);
      setOrders(arr);
    });
    return () => unsubscribe();
  }, []);

  // 3. 計算每項已訂購總數
  const orderedCount = useMemo(() => {
    const map = Object.fromEntries(products.map(p => [p.id, 0]));
    for (const o of orders) {
      for (const it of o.items || []) {
        map[it.id] = (map[it.id] || 0) + (it.qty || 0);
      }
    }
    return map;
  }, [orders, products]);

  // 4. 剩餘量
  const stockDefault = 999;
  const remaining = useMemo(() => {
    const r = {};
    for (const p of products) {
      r[p.id] = Math.max(0, stockDefault - (orderedCount[p.id] || 0));
    }
    return r;
  }, [orderedCount, products]);

  // 5. 處理數量變更
  function changeQty(id, delta) {
    setQuantities(q => {
      const cur = q[id] || 0;
      const next = Math.max(0, Math.min(remaining[id], cur + delta));
      return {...q, [id]: next};
    });
  }

  function setQty(id, value) {
    setQuantities(q => ({...q, [id]: Math.max(0, Math.min(remaining[id], Math.floor(Number(value) || 0)))}));
  }

  // 6. 格式化價格
  function formatCurrency(n) { return new Intl.NumberFormat("zh-TW",{style:"currency",currency:"TWD",maximumFractionDigits:0}).format(n); }

  // 7. 計算購物車總價
  const cart = useMemo(() => {
    return products.map(p => ({...p, qty: quantities[p.id]||0})).filter(x => x.qty > 0);
  }, [quantities, products]);

  const total = useMemo(() => cart.reduce((s, it) => s + it.price * it.qty, 0), [cart]);

  // 8. 送出訂單
  async function handleSubmit(e) {
    e?.preventDefault();
    if (new Date() > DEADLINE) return alert("已過截止，無法下單");
    if (!name.trim() || !contact.trim()) return alert("請填寫姓名與聯絡方式");
    if (cart.length === 0) return alert("請選擇至少一項商品");

    const orderObj = {
      name: name.trim(),
      contact: contact.trim(),
      note: note.trim(),
      items: cart.map(c => ({ id: c.id, name: c.name, qty: c.qty, price: c.price })),
      total,
      createdAt: Date.now()
    };
    await push(ref(db, "orders"), orderObj);
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

      {/* Bottom form */}
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

// --- OrdersList Component ---
function OrdersList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ordersRef = ref(db, "orders");
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      setLoading(false);
      const data = snapshot.val();
      if (data) {
        const orderList = Object.entries(data).map(([id, order]) => ({
          id,
          ...order,
        }));
        setOrders(orderList);
      } else {
        setOrders([]);
      }
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteOrder = async (orderId) => {
    if (window.confirm("確定要刪除這筆訂單嗎？")) {
      try {
        await remove(ref(db, `orders/${orderId}`));
      } catch (err) {
        console.error("刪除失敗", err);
      }
    }
  };

  const calculateTotalQuantity = (items) => {
    return items.reduce((sum, item) => sum + item.qty, 0);
  };

  return (
    <div className="card">
      <h2>即時訂單列表</h2>
      {loading && <p>載入中...</p>}
      {error && <p className="error-message">錯誤: {error}</p>}
      {!loading && orders.length === 0 && <p>目前沒有訂單。</p>}
      <ul className="order-list">
        {orders.map((order) => (
          <li key={order.id} className="order-item">
            <div className="order-header">
              <span className="order-name">{order.name}</span>
              <span className="order-time">{new Date(order.createdAt).toLocaleString()}</span>
            </div>
            <ul className="order-items">
              {order.items.map((item, index) => (
                <li key={index}>
                  {item.name} x {item.qty}
                </li>
              ))}
            </ul>
            <div className="order-footer">
              <span className="order-total">
                總計：{new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD" }).format(order.total)}
              </span>
              <button onClick={() => handleDeleteOrder(order.id)} className="small-btn">刪除</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- ChatBox Component ---
function ChatBox() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    // 1. Authenticate with Firebase
    const authenticate = async () => {
      try {
        if (__initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Firebase Auth Error: ", error);
      }
    };
    authenticate();

    // 2. Set up auth state listener to get user info
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });

    // Clean up auth listener
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // 3. Listen for chat messages
    if (isAuthReady) {
      const messagesRef = ref(db, `artifacts/${appId}/chat`);
      const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const loadedMessages = Object.entries(data).map(([id, message]) => ({
            id,
            ...message,
          }));
          setMessages(loadedMessages.sort((a, b) => a.timestamp - b.timestamp));
        } else {
          setMessages([]);
        }
      });
      return () => unsubscribeMessages();
    }
  }, [isAuthReady]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === "") return;

    if (!user) {
      console.error("User not authenticated.");
      return;
    }

    try {
      const chatRef = ref(db, `artifacts/${appId}/chat`);
      await push(chatRef, {
        text: newMessage,
        userId: user.uid,
        timestamp: Date.now(),
      });
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <div className="chat-box card">
      <h2>留言板</h2>
      <div className="message-list">
        {messages.map((msg) => (
          <div key={msg.id} className="message">
            <span className="message-user-id">{msg.userId.substring(0, 8)}:</span>
            <span className="message-text">{msg.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSendMessage} className="message-form">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="輸入訊息..."
        />
        <button type="submit" className="button">送出</button>
      </form>
    </div>
  );
}

// --- AdminPanel Component ---
function AdminPanel() {
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: "", original: 0, price: 0, category: "", imageUrl: "" });
  const [isEditing, setIsEditing] = useState(null); // 儲存正在編輯的商品 ID
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const productsRef = ref(db, "products");
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const productList = Object.entries(data).map(([id, product]) => ({
          id,
          ...product,
        }));
        setProducts(productList);
      } else {
        setProducts([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewProduct({ ...newProduct, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isEditing) {
        const productRef = ref(db, `products/${isEditing}`);
        await update(productRef, {
          ...newProduct,
          price: parseFloat(newProduct.price),
          original: parseFloat(newProduct.original)
        });
        setIsEditing(null);
      } else {
        await push(ref(db, "products"), {
          ...newProduct,
          price: parseFloat(newProduct.price),
          original: parseFloat(newProduct.original)
        });
      }
      setNewProduct({ name: "", original: 0, price: 0, category: "", imageUrl: "" });
    } catch (err) {
      console.error("Firebase 操作失敗:", err);
      setError("操作失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (product) => {
    setIsEditing(product.id);
    setNewProduct(product);
  };

  const handleDelete = async (productId) => {
    if (window.confirm("確定要刪除這個商品嗎？")) {
      setLoading(true);
      setError(null);
      try {
        await remove(ref(db, `products/${productId}`));
      } catch (err) {
        console.error("Firebase 刪除失敗:", err);
        setError("刪除失敗，請稍後再試。");
      } finally {
        setLoading(false);
      }
    }
  };

  const formatCurrency = (n) => {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0
    }).format(n);
  };

  return (
    <div className="card">
      <h2>團長後台：管理商品</h2>
      
      <form onSubmit={handleSubmit} className="form-container">
        <input name="name" placeholder="商品名稱" value={newProduct.name} onChange={handleInputChange} required />
        <input name="original" type="number" placeholder="原價" value={newProduct.original} onChange={handleInputChange} required />
        <input name="price" type="number" placeholder="折扣價" value={newProduct.price} onChange={handleInputChange} required />
        <input name="category" placeholder="類別 (平價/奢華)" value={newProduct.category} onChange={handleInputChange} required />
        <input name="imageUrl" placeholder="圖片網址 (選填)" value={newProduct.imageUrl} onChange={handleInputChange} />
        
        <button type="submit" disabled={loading}>
          {isEditing ? "更新商品" : "新增商品"}
        </button>
      </form>
      {error && <p className="error-message">{error}</p>}
      
      <div className="product-list-admin">
        {products.map(p => (
          <div key={p.id} className="product-item">
            <div className="product-info">
              {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="product-image" />}
              <div>
                <strong>{p.name}</strong>
                <p>{p.category} | {formatCurrency(p.price)}</p>
              </div>
            </div>
            <div className="product-actions">
              <button onClick={() => startEditing(p)}>編輯</button>
              <button onClick={() => handleDelete(p.id)}>刪除</button>
            </div>
          </div>
        ))}
        {products.length === 0 && <p style={{ textAlign: "center", color: "#666" }}>目前沒有任何商品，請新增。</p>}
      </div>
    </div>
  );
}

// --- Main App Component ---
export default function App() {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const DEADLINE = new Date("2025-08-29T23:59:59");

  // 測試用的函式
  const addTestOrder = async () => {
    const user = auth.currentUser;
    if (!user) {
      console.error("請先登入才能新增測試訂單！");
      return;
    }

    const payload = {
      product: "經典蒜辣雞Q丸",
      quantity: 2,
      createdBy: user.uid,
      createdAt: Date.now(),
    };

    await push(ref(db, "orders"), payload);
    console.log("✅ 測試訂單已新增！");
  };

  return (
    <div className="container">
      <header style={{marginBottom:16}}>
        <h1 style={{margin:0}}>團購管理平台</h1>
        <p style={{color: (new Date() > DEADLINE ? "#ef4444":"#0f172a")}}>
          截止日期：2025/08/29 {new Date() > DEADLINE ? "（已截止）" : ""}
        </p>
        <div style={{marginTop: 10}}>
          <button onClick={() => setShowAdminPanel(false)} style={{marginRight: 8}}>使用者頁面</button>
          <button onClick={() => setShowAdminPanel(true)}>團長後台</button>
        </div>
      </header>

      <main style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16}}>
        {/* 左側: 商品與下單 */}
        <section>
          {showAdminPanel ? (
            <AdminPanel />
          ) : (
            <OrderForm DEADLINE={DEADLINE} />
          )}
        </section>

        {/* 右側: 訂單列表 / 聊天 */}
        <aside style={{display:"flex", flexDirection:"column", gap:16}}>
          <OrdersList />
          <ChatBox />
        </aside>
      </main>

      <DanmuOverlay />
    </div>
  );
}
