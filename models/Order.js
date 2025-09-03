// models/Order.js

const mongoose = require('mongoose');

// 定義單個品項在訂單中的 Schema
const itemSchema = new mongoose.Schema({
  name: String,
  price: Number,
  quantity: Number,
});

// 定義訂單的 Schema
const orderSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
  },
  items: {
    type: [itemSchema], // 是一個包含多個品項的陣列
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid'], // 付款狀態只有兩種選擇
    default: 'unpaid',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 建立 Model
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
