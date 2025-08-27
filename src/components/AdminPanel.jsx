import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, onValue, update, remove } from "firebase/database";

// Check for the global Firebase config variable provided by the environment
// If not available, use a placeholder to prevent errors.
const firebaseConfig = typeof __firebase_config !== "undefined"
  ? JSON.parse(__firebase_config)
  : {};

// Initialize Firebase only once
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default function AdminPanel() {
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: "", original: 0, price: 0, category: "", imageUrl: "" });
  const [isEditing, setIsEditing] = useState(null); // Stores the ID of the product being edited
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Load product data from Firebase
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

  // 2. Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewProduct({ ...newProduct, [name]: value });
  };

  // 3. Add or update a product
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isEditing) {
        // Update product
        const productRef = ref(db, `products/${isEditing}`);
        await update(productRef, {
          ...newProduct,
          price: parseFloat(newProduct.price),
          original: parseFloat(newProduct.original)
        });
        setIsEditing(null);
      } else {
        // Add new product
        await push(ref(db, "products"), {
          ...newProduct,
          price: parseFloat(newProduct.price),
          original: parseFloat(newProduct.original)
        });
      }
      setNewProduct({ name: "", original: 0, price: 0, category: "", imageUrl: "" }); // Clear the form
    } catch (err) {
      console.error("Firebase operation failed:", err);
      setError("Operation failed, please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // 4. Start editing mode
  const startEditing = (product) => {
    setIsEditing(product.id);
    setNewProduct(product);
  };

  // 5. Delete a product
  const handleDelete = async (productId) => {
    if (window.confirm("確定要刪除這個商品嗎？")) {
      setLoading(true);
      setError(null);
      try {
        await remove(ref(db, `products/${productId}`));
      } catch (err) {
        console.error("Firebase deletion failed:", err);
        setError("Deletion failed, please try again later.");
      } finally {
        setLoading(false);
      }
    }
  };

  // 6. Format currency
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
      
      {/* Add/Edit form */}
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
      
      {/* Product list */}
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
