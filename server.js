// server.js

// 引入所需的函式庫
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// 引入資料庫模型
const Product = require('./models/Product');
const Order = require('./models/Order');

// 建立 Express 應用程式和設定連線埠
const app = express();
const PORT = process.env.PORT || 5000;

// 設定一個只有你知道的 API Key，用來保護管理員操作
const ADMIN_API_KEY = 'Annie0309@@'; // 請務必更改此處的密碼！

// 中介軟體 (Middleware)
// 允許來自不同網域的請求
app.use(cors());
// 讓 Express 能夠解析 JSON 格式的請求內容
app.use(express.json());

// 保護管理員 API 的中介軟體
const authenticateAdmin = (req, res, next) => {
  const apiKey = req.headers['x-api-key']; // 從請求的標頭中獲取 API Key
  if (apiKey && apiKey === ADMIN_API_KEY) {
    next(); // 如果 API Key 正確，繼續執行下一個路由
  } else {
    res.status(401).json({ message: '未經授權，請提供正確的 API Key' });
  }
};

// 連接 MongoDB
mongoose.connect('mongodb://localhost:27017/groupbuy')
  .then(() => console.log('MongoDB 連接成功！'))
  .catch(err => console.error('MongoDB 連接失敗：', err));

// -------------------------
// API 路由 (API Routes)
// -------------------------

// --- 品項 API ---

// 1. 新增一個品項 (需要 API Key)
app.post('/api/products', authenticateAdmin, async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 2. 取得所有品項
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. 更新一個品項 (需要 API Key)
app.patch('/api/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedProduct) {
      return res.status(404).json({ message: '找不到品項' });
    }
    res.json(updatedProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 4. 刪除一個品項 (需要 API Key)
app.delete('/api/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ message: '找不到品項' });
    }
    res.json({ message: '品項已刪除' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- 訂單 API ---

// 5. 新增一筆訂單
app.post('/api/orders', async (req, res) => {
  try {
    const newOrder = new Order(req.body);
    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 6. 取得所有訂單 (只供管理員使用，需要 API Key)
app.get('/api/orders', authenticateAdmin, async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 7. 更新訂單狀態（需要 API Key）
app.patch('/api/orders/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { paymentStatus: paymentStatus },
      { new: true }
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: '找不到訂單' });
    }
    res.json(updatedOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`伺服器正在運行於 http://localhost:${PORT}`);
});
