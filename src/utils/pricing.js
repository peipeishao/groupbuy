// src/utils/pricing.js
// 集中管理折扣設定 & 金額計算 & 金額格式化（維持向下相容）

/**
 * 折扣設定
 * - active:   是否啟用折扣
 * - mode:     折扣模式（目前為 "perItem"：每件折固定金額）
 * - perItem:  每件折多少
 * - label:    顯示用文字
 */
export const DISCOUNT = {
  active: true,
  mode: "perItem",          // ← 新增欄位：保留擴充性（未來可支援滿額折等）
  perItem: 3,               // 每件折 3 元
  label: "折扣活動：每件折 $3",
};

/**
 * 金額格式（0 位小數）
 */
export const ntd0 = (n) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n) || 0));

/**
 * 金額格式（1 位小數）— 方便在表格/明細統一顯示
 */
export const ntd1 = (n) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(n) || 0);

/**
 * 將來源 items 整理為 {price, qty} 形狀（容錯）
 * - 支援 items 內含 { price, qty } 或 { price, quantity } 等欄位
 */
export function normalizeItems(items = []) {
  return (Array.isArray(items) ? items : []).map((x) => ({
    price: Number(x?.price ?? x?.unitPrice ?? 0),
    qty: Number(x?.qty ?? x?.quantity ?? 0),
    // 保留其他欄位不動
    ...x,
  }));
}

/**
 * 產生可直接寫入訂單的折扣描述欄位
 * 用法：discountMeta: makeDiscountMeta()
 */
export function makeDiscountMeta(cfg = DISCOUNT) {
  return {
    type: cfg?.mode || "perItem",
    perItem: Number(cfg?.perItem || 0),
    label: String(cfg?.label || "折扣活動"),
    active: !!cfg?.active,
  };
}

/**
 * 計算小計/折扣/折後（維持向下相容）
 * - 仍保留原有呼叫方式：calcPriceBreakdown(items)
 * - 新增可選第二參數 cfg（預設使用 DISCOUNT）
 * - 回傳多加 totalAfterDiscount 與 label，方便直接寫 DB 或 UI 顯示
 *
 * @param {Array} items - [{ id, name, price, qty }, ...]
 * @param {Object} cfg  - 折扣設定（預設 DISCOUNT）
 * @returns {Object} { subtotal, discount, total, totalAfterDiscount, itemCount, label }
 *   - total 與 totalAfterDiscount 相同（為了向下相容保留 total 命名）
 */
export function calcPriceBreakdown(items = [], cfg = DISCOUNT) {
  const list = normalizeItems(items);

  const subtotal = list.reduce(
    (s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0),
    0
  );
  const itemCount = list.reduce((s, it) => s + (Number(it.qty) || 0), 0);

  let discount = 0;
  if (cfg?.active && cfg?.mode === "perItem") {
    discount = Math.max(itemCount * Number(cfg.perItem || 0), 0);
  }

  const totalAfterDiscount = Math.max(subtotal - discount, 0);

  // 為了相容舊程式，total = 折後總額
  return {
    subtotal,
    discount,
    total: totalAfterDiscount,
    totalAfterDiscount,
    itemCount,
    label: cfg?.label || "折扣活動",
  };
}
