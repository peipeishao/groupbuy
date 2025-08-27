// models/Product.js

const mongoose = require('mongoose');

// 定義品項的 Schema
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  image: {
    type: String, // 這裡儲存圖片的 URL
    required: false, // 圖片不是必填的
  },
  // 可以根據需求新增更多欄位，例如：描述、分類等
});

// 建立 Model
const Product = mongoose.model('Product', productSchema);

module.exports = Product;
