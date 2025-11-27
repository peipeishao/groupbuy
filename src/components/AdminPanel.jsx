// src/components/AdminPanel.jsx
import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase.js";
import { ref, push, onValue, update, remove } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";
import AdminOrdersPanel from "./AdminOrdersPanel.jsx";
import AdminSummaryPanel from "./AdminSummaryPanel.jsx";
import AdminNoticePanel from "./AdminNoticePanel.jsx";
import AdminPaymentInfo from "./AdminPaymentInfo.jsx";

// ── 工具 & 常數 ─────────────────────────────────────────
const fmt1 = (n) =>
  new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(n) || 0);
const ntd1 = (n) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(n) || 0);

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function toInt(v, def = 0) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : def;
}
function toMoney1(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}
function toSlug(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

// datetime-local <-> ms
const toInput = (ms) => {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(n);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromInput = (s) => {
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
};

const STATUS_OPTS = [
  { value: "upcoming", label: "尚未開始", color: "#3b82f6" },
  { value: "ongoing", label: "開團中", color: "#f59e0b" },
  { value: "shipped", label: "開團成功", color: "#16a34a" },
  { value: "ended", label: "開團結束", color: "#94a3b8" },
];

// 將本機檔案轉成 data URL（給 banner/hero 圖）
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export default function AdminPanel() {
  let player = null;
  try {
    player = usePlayer();
  } catch {}
  const isAdmin = !!player?.isAdmin;
  const uid = player?.uid || "";
  const roleName = player?.roleName || "Admin";

  // ⬇️ 分頁：多了一個「upload」＝上傳商品
  const [tab, setTab] = useState("upload");
  const tabBtn = (k, label) => (
    <button
      onClick={() => setTab(k)}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: tab === k ? "#111827" : "#fff",
        color: tab === k ? "#fff" : "#111827",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  // ── 商品管理狀態 ────────────────────────────────
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    name: "",
    original: "",
    price: "",
    category: "chicken",
    imageUrl: "",
    unit: "包",
    stockCapacity: "", // 可售總量（0/空＝不限制）
    minQty: "1", // 每筆最低下單量
    active: true,
  });
  const [imgPreview, setImgPreview] = useState("");
  const [useCustomCat, setUseCustomCat] = useState(false);
  const [customCat, setCustomCat] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ❶ 讀取產品
  useEffect(() => {
    const off = onValue(ref(db, "products"), (snap) => {
      const v = snap.val() || {};
      const list = Object.entries(v).map(([id, p]) => ({
        id,
        ...p,
      }));
      list.sort(
        (a, b) =>
          (b.createdAt || 0) - (a.createdAt || 0) ||
          String(a.name).localeCompare(String(b.name))
      );
      setProducts(list);
    });
    return () => off();
  }, []);

  // ❷ 讀取所有攤位（每攤位開團設定＋圖片＋介紹）
  const [stalls, setStalls] = useState([]);
  useEffect(() => {
    const off = onValue(ref(db, "stalls"), (snap) => {
      const v = snap.val() || {};
      const list = Object.entries(v).map(([id, s]) => ({
        id,
        title: String(s?.title || id),
        campaign: s?.campaign || null,
        bannerUrl: String(s?.bannerUrl || ""),
        heroUrl: String(s?.heroUrl || ""),
        intro: String(s?.intro || ""),
        rules: String(s?.rules || ""),
      }));
      list.sort((a, b) =>
        String(a.title).localeCompare(String(b.title))
      );
      setStalls(list);
    });
    return () => off();
  }, []);

  // ❸ products 的 category + stalls id 一起當作「可選攤位」
  const derivedCats = useMemo(() => {
    const s = new Set();
    for (const p of products) {
      const cat = String(p?.category || "").trim();
      if (cat) s.add(cat);
    }
    return Array.from(s);
  }, [products]);

  const selectOptions = useMemo(() => {
    const m = new Map(); // id -> label
    for (const st of stalls) m.set(st.id, st.title);
    for (const id of derivedCats) {
      if (!m.has(id)) m.set(id, id);
    }
    return Array.from(m, ([id, label]) => ({ id, label }));
  }, [stalls, derivedCats]);

  function onChange(e) {
    const { name, value, type, checked } = e.target;
    if (name === "active") {
      setForm((s) => ({ ...s, active: !!checked }));
    } else {
      setForm((s) => ({ ...s, [name]: value }));
    }
  }

  const validationMsg = useMemo(() => {
    const name = String(form.name || "").trim();
    if (!name) return "請輸入商品名稱";
    if (name.length > 50) return "商品名稱請在 50 字以內";

    const price = toNumber(form.price),
      original = toNumber(form.original);
    if (price <= 0) return "售價需為正數";
    if (original < 0) return "原價不可為負數";
    if (original && price > original) return "折扣價不可高於原價";

    const img = String(form.imageUrl || "").trim();
    if (img) {
      const okHttp = /^https?:\/\//i.test(img);
      const okData =
        /^data:image\/(png|jpe?g|webp);base64,/i.test(img);
      if (!okHttp && !okData)
        return "圖片需為 http(s) 連結或 data:image;base64 資料 URI";
    }

    const cap =
      form.stockCapacity === "" ? 0 : toInt(form.stockCapacity, -1);
    if (cap < 0)
      return "可售總量需為不小於 0 的整數（空白或 0 表示不限制）";

    const minQ = toInt(form.minQty, 1);
    if (minQ < 1) return "每筆最低下單量需為 ≥1 的整數";

    if (useCustomCat) {
      const slug = toSlug(customCat);
      if (!slug)
        return "請輸入自訂分類（英數小寫，可含 - _）";
    } else if (!form.category) return "請選擇分類";

    return "";
  }, [form, useCustomCat, customCat]);

  async function onSubmit(e) {
    e?.preventDefault?.();
    setErr("");
    if (!isAdmin) {
      setErr("需要管理員權限");
      return;
    }
    if (validationMsg) {
      setErr(validationMsg);
      return;
    }

    const categoryFinal = useCustomCat
      ? toSlug(customCat)
      : String(form.category);
    const price1 = toMoney1(form.price);
    const original1 = toMoney1(form.original);
    const cap =
      form.stockCapacity === "" ? 0 : toInt(form.stockCapacity, 0);
    const minQ = toInt(form.minQty, 1);

    setLoading(true);
    try {
      const payload = {
        name: String(form.name || "").trim(),
        original: original1 || null,
        price: price1,
        category: categoryFinal,
        imageUrl: String(form.imageUrl || "").trim() || null,
        unit: String(form.unit || "包"),
        stockCapacity: cap,
        minQty: minQ,
        active: !!form.active,
        updatedAt: Date.now(),
      };
      if (editingId) {
        await update(ref(db, `products/${editingId}`), payload);
        setEditingId(null);
      } else {
        await push(ref(db, "products"), {
          ...payload,
          createdAt: Date.now(),
          createdBy: { uid, roleName },
        });
      }
      setForm({
        name: "",
        original: "",
        price: "",
        category: categoryFinal,
        imageUrl: "",
        unit: "包",
        stockCapacity: "",
        minQty: "1",
        active: true,
      });
      setImgPreview("");
      setUseCustomCat(false);
      setCustomCat("");
    } catch (e) {
      console.error("[AdminPanel] submit failed:", e);
      setErr("操作失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      name: p.name || "",
      original: String(p.original ?? ""),
      price: String(p.price ?? ""),
      category: String(p.category || "chicken"),
      imageUrl: p.imageUrl || "",
      unit: p.unit || "包",
      stockCapacity:
        p.stockCapacity === 0 || p.stockCapacity == null
          ? ""
          : String(p.stockCapacity),
      minQty: String(p.minQty ?? "1"),
      active: p.active !== false,
    });
    setImgPreview(p.imageUrl || "");
    setUseCustomCat(false);
    setCustomCat("");
    setTab("upload"); // 編輯時自動切到「上傳商品」分頁
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onDelete(id) {
    if (!isAdmin) {
      setErr("需要管理員權限");
      return;
    }
    if (!window.confirm("確定要刪除這個商品嗎？")) return;
    try {
      await remove(ref(db, `products/${id}`));
    } catch (e) {
      console.error("[AdminPanel] delete failed:", e);
      setErr("刪除失敗，請稍後再試");
    }
  }

  // ── 每攤位開團設定（本地編輯 → 儲存到 RTDB） ──
  const [editingStallCamp, setEditingStallCamp] = useState({});
  const [savingStallId, setSavingStallId] = useState("");

  useEffect(() => {
    const m = {};
    for (const s of stalls) {
      const c = s.campaign || {};
      m[s.id] = {
        status: c.status || "ongoing",
        startAt: c.startAt ?? null,
        closeAt: c.closeAt ?? null,
        arriveAt: c.arriveAt ?? null,
      };
    }
    setEditingStallCamp(m);
  }, [stalls]);

  const updateField = (stallId, key, value) => {
    setEditingStallCamp((prev) => ({
      ...prev,
      [stallId]: { ...(prev[stallId] || {}), [key]: value },
    }));
  };

  // 攤位圖片 / 介紹 的本地編輯狀態
  const [editingStallMeta, setEditingStallMeta] = useState({});
  useEffect(() => {
    const m = {};
    for (const s of stalls) {
      m[s.id] = {
        bannerUrl: s.bannerUrl || "",
        heroUrl: s.heroUrl || "",
        intro: s.intro || "",
        rules: s.rules || "",
      };
    }
    setEditingStallMeta(m);
  }, [stalls]);

  const updateStallMetaField = (stallId, key, value) => {
    setEditingStallMeta((prev) => ({
      ...prev,
      [stallId]: { ...(prev[stallId] || {}), [key]: value },
    }));
  };

  const saveStallCampaign = async (stallId) => {
    const c = editingStallCamp[stallId];
    const m = editingStallMeta[stallId] || {};
    if (!c) return;
    setSavingStallId(stallId);
    try {
      await update(ref(db, `stalls/${stallId}`), {
        title: stalls.find((st) => st.id === stallId)?.title || stallId,
        bannerUrl: m.bannerUrl || "",
        heroUrl: m.heroUrl || "",
        intro: m.intro || "",
        rules: m.rules || "",
        campaign: {
          status: c.status || "ongoing",
          startAt: c.startAt ?? null,
          closeAt: c.closeAt ?? null,
          arriveAt: c.arriveAt ?? null,
          updatedAt: Date.now(),
        },
      });
      alert(`已更新「${stallId}」的開團設定 & 攤位資訊！`);
    } catch (e) {
      console.error("[saveStallCampaign] failed", e);
      alert("儲存失敗，請稍後再試");
    } finally {
      setSavingStallId("");
    }
  };

  const clearStallCampaign = async (stallId) => {
    if (
      !window.confirm(
        `確定要清除攤位「${stallId}」的開團設定嗎？`
      )
    )
      return;
    setSavingStallId(stallId);
    try {
      await remove(ref(db, `stalls/${stallId}/campaign`));
      alert(`已清除「${stallId}」的開團設定`);
    } catch (e) {
      console.error("[clearStallCampaign] failed", e);
      alert("清除失敗，請稍後再試");
    } finally {
      setSavingStallId("");
    }
  };

  // ── 新增攤位（同時建立 stalls 節點） ──
  const [newStall, setNewStall] = useState({ id: "", title: "" });
  const [creatingStall, setCreatingStall] = useState(false);
  const [stallFormErr, setStallFormErr] = useState("");

  const handleNewStallChange = (e) => {
    const { name, value } = e.target;
    setNewStall((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateStall = async (e) => {
    e?.preventDefault?.();
    setStallFormErr("");
    if (!isAdmin) {
      setStallFormErr("需要管理員權限");
      return;
    }
    const rawId = newStall.id || newStall.title;
    const slug = toSlug(rawId);
    if (!slug) {
      setStallFormErr(
        "請先輸入攤位 ID 或名稱（會自動轉成英數 ID）"
      );
      return;
    }
    const title = String(newStall.title || "").trim() || slug;

    setCreatingStall(true);
    try {
      await update(ref(db, `stalls/${slug}`), {
        title,
        createdAt: Date.now(),
        createdBy: { uid, roleName },
      });
      setNewStall({ id: "", title: "" });
      alert(`已建立攤位「${title}（${slug}）」！`);
    } catch (e) {
      console.error("[createStall] failed", e);
      setStallFormErr("建立攤位失敗，請稍後再試");
    } finally {
      setCreatingStall(false);
    }
  };

  // ── UI ────────────────────────────────────────────────
  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        {/* 標題 + 分頁切換 */}
        <div style={styles.header}>
          <div style={styles.title}>團長後台：管理中心</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {tabBtn("upload", "上傳商品")}
            {tabBtn("products", "管理商品 / 攤位")}
            {tabBtn("orders", "管理訂單")}
            {tabBtn("summary", "分攤合計")}
            {tabBtn("notice", "公告")}
            {tabBtn("payment", "付款資訊")}
          </div>
        </div>

        {/* ── 上傳商品分頁 ─────────────────────────────── */}
        {tab === "upload" && (
          <form onSubmit={onSubmit} style={styles.form}>
            <div style={styles.row}>
              <label style={styles.label}>商品名稱</label>
              <input
                name="name"
                value={form.name}
                onChange={onChange}
                placeholder="例如：義式香草雞胸肉"
                style={styles.input}
              />
            </div>

            <div style={styles.row2}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={styles.label}>原價（可留空）</label>
                <input
                  name="original"
                  value={form.original}
                  onChange={onChange}
                  inputMode="decimal"
                  placeholder="例如：45"
                  style={styles.input}
                />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={styles.label}>售價</label>
                <input
                  name="price"
                  value={form.price}
                  onChange={onChange}
                  inputMode="decimal"
                  placeholder="例如：39.9"
                  style={styles.input}
                />
              </div>
              <div style={{ flex: 0.7, minWidth: 90 }}>
                <label style={styles.label}>單位</label>
                <input
                  name="unit"
                  value={form.unit}
                  onChange={onChange}
                  placeholder="例如：包／盒"
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.row2}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label style={styles.label}>分類 / 攤位</label>
                {!useCustomCat && (
                  <select
                    name="category"
                    value={form.category}
                    onChange={onChange}
                    style={styles.input}
                  >
                    {selectOptions.length === 0 && (
                      <option value="">
                        尚未建立攤位或分類
                      </option>
                    )}
                    {selectOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}（{o.id}）
                      </option>
                    ))}
                  </select>
                )}
                {useCustomCat && (
                  <input
                    value={customCat}
                    onChange={(e) => setCustomCat(e.target.value)}
                    placeholder="輸入自訂 ID，例如：newvendor"
                    style={styles.input}
                  />
                )}
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  這裡請填 <b>newvendor</b> 就會出現在新雞胸攤位。
                </div>
              </div>
              <div
                style={{
                  flex: 0,
                  display: "flex",
                  alignItems: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => setUseCustomCat((x) => !x)}
                  style={styles.smallBtn}
                >
                  {useCustomCat ? "改用下拉選單" : "改用自訂 ID"}
                </button>
              </div>
            </div>

            <div style={styles.row}>
              <label style={styles.label}>
                商品圖片網址 / 上傳
              </label>
              <input
                name="imageUrl"
                value={form.imageUrl}
                onChange={(e) => {
                  onChange(e);
                  setImgPreview(e.target.value || "");
                }}
                placeholder="http(s) / data:image;base64 都可"
                style={styles.input}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const dataUrl = await fileToDataUrl(file);
                    setForm((s) => ({ ...s, imageUrl: dataUrl }));
                    setImgPreview(dataUrl);
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                  }}
                >
                  上傳後會自動存成 data URL
                </span>
              </div>
              {imgPreview ? (
                <img
                  src={imgPreview}
                  alt="preview"
                  style={{
                    marginTop: 6,
                    width: 160,
                    height: 160,
                    objectFit: "cover",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                  }}
                />
              ) : null}
            </div>

            <div style={styles.row2}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={styles.label}>
                  可售總量（0 或空白＝不限制）
                </label>
                <input
                  name="stockCapacity"
                  value={form.stockCapacity}
                  onChange={onChange}
                  inputMode="numeric"
                  placeholder="例如：60"
                  style={styles.input}
                />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={styles.label}>每筆最低下單量</label>
                <input
                  name="minQty"
                  value={form.minQty}
                  onChange={onChange}
                  inputMode="numeric"
                  placeholder="例如：1 或 5"
                  style={styles.input}
                />
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 0,
                  marginLeft: 8,
                }}
              >
                <input
                  type="checkbox"
                  name="active"
                  checked={form.active}
                  onChange={onChange}
                />
                <span style={{ fontSize: 13 }}>上架中</span>
              </label>
            </div>

            {err && <div style={styles.error}>{err}</div>}
            {validationMsg && !err && (
              <div style={styles.error}>{validationMsg}</div>
            )}

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 8,
              }}
            >
              <button
                type="submit"
                disabled={loading}
                style={styles.primaryBtn}
              >
                {loading
                  ? "儲存中…"
                  : editingId
                  ? "更新商品"
                  : "新增商品"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm({
                      name: "",
                      original: "",
                      price: "",
                      category: "chicken",
                      imageUrl: "",
                      unit: "包",
                      stockCapacity: "",
                      minQty: "1",
                      active: true,
                    });
                    setImgPreview("");
                    setUseCustomCat(false);
                    setCustomCat("");
                  }}
                  style={styles.secondaryBtn}
                >
                  取消編輯
                </button>
              )}
            </div>
          </form>
        )}

        {/* ── 管理商品 / 攤位 分頁 ───────────────────── */}
        {tab === "products" && (
          <>
            {/* 新增攤位（stalls） */}
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid #eee",
                background: "#fff7ed",
              }}
            >
              <div
                style={{ fontWeight: 900, marginBottom: 8 }}
              >
                新增攤位（stalls）
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  marginBottom: 8,
                }}
              >
                在小鎮畫面新增木牌時，請先在這裡建立一個攤位
                ID。之後「開團設定」和「商品分類」就會用同一個 ID。
              </div>
              <form
                onSubmit={handleCreateStall}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "flex-end",
                }}
              >
                <div
                  style={{
                    flex: "1 1 160px",
                    minWidth: 160,
                  }}
                >
                  <label style={styles.label}>
                    攤位 ID（英數小寫，可含 - _）
                  </label>
                  <input
                    name="id"
                    value={newStall.id}
                    onChange={handleNewStallChange}
                    placeholder="例如：chicken / newvendor"
                    style={styles.input}
                  />
                </div>
                <div
                  style={{
                    flex: "2 1 200px",
                    minWidth: 200,
                  }}
                >
                  <label style={styles.label}>
                    攤位名稱 / 顯示標題
                  </label>
                  <input
                    name="title"
                    value={newStall.title}
                    onChange={handleNewStallChange}
                    placeholder="例如：大成雞胸肉專區"
                    style={styles.input}
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingStall}
                  style={styles.primaryBtn}
                >
                  {creatingStall ? "建立中…" : "新增攤位"}
                </button>
                {stallFormErr && (
                  <div
                    style={{
                      ...styles.error,
                      flexBasis: "100%",
                    }}
                  >
                    {stallFormErr}
                  </div>
                )}
              </form>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "#9ca3af",
                }}
              >
                小提醒：攤位 ID 會自動轉成英數小寫（toSlug），請和木牌的
                stallId & 商品分類保持一致。
              </div>
            </div>

            {/* 每攤位開團設定＋圖片/介紹 */}
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid #eee",
                background: "#f8fafc",
              }}
            >
              <div
                style={{ fontWeight: 900, marginBottom: 10 }}
              >
                每攤位開團設定 & 外觀
              </div>
              {stalls.length === 0 ? (
                <div style={{ color: "#64748b" }}>
                  尚未建立任何攤位（stalls）。
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(280px,1fr))",
                  }}
                >
                  {stalls.map((s) => {
                    const c = editingStallCamp[s.id] || {};
                    const meta = editingStallMeta[s.id] || {};
                    const saving = savingStallId === s.id;
                    return (
                      <div
                        key={s.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          background: "#fff",
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 900,
                            marginBottom: 8,
                          }}
                        >
                          {s.title}{" "}
                          <span
                            style={{ color: "#94a3b8" }}
                          >
                            （{s.id}）
                          </span>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <div>
                            <label style={styles.label}>
                              狀態
                            </label>
                            <select
                              value={c.status || "ongoing"}
                              onChange={(e) =>
                                updateField(
                                  s.id,
                                  "status",
                                  e.target.value
                                )
                              }
                              style={styles.input}
                            >
                              {STATUS_OPTS.map((o) => (
                                <option
                                  key={o.value}
                                  value={o.value}
                                >
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={styles.label}>
                              開團開始時間（可留空）
                            </label>
                            <input
                              type="datetime-local"
                              value={toInput(c.startAt)}
                              onChange={(e) =>
                                updateField(
                                  s.id,
                                  "startAt",
                                  fromInput(e.target.value)
                                )
                              }
                              style={styles.input}
                            />
                          </div>

                          <div>
                            <label style={styles.label}>
                              收單截止時間
                            </label>
                            <input
                              type="datetime-local"
                              value={toInput(c.closeAt)}
                              onChange={(e) =>
                                updateField(
                                  s.id,
                                  "closeAt",
                                  fromInput(e.target.value)
                                )
                              }
                              style={styles.input}
                            />
                          </div>

                          <div>
                            <label style={styles.label}>
                              貨到時間（可留空）
                            </label>
                            <input
                              type="datetime-local"
                              value={toInput(c.arriveAt)}
                              onChange={(e) =>
                                updateField(
                                  s.id,
                                  "arriveAt",
                                  fromInput(e.target.value)
                                )
                              }
                              style={styles.input}
                            />
                          </div>
                        </div>

                        {/* 攤位圖片 & 介紹，會顯示在訂單視窗上方 */}
                        <div
                          style={{
                            marginTop: 8,
                            paddingTop: 8,
                            borderTop:
                              "1px dashed #e5e7eb",
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              color: "#6b7280",
                              fontWeight: 700,
                            }}
                          >
                            攤位圖片 & 介紹（會顯示在訂單視窗上方）
                          </div>

                          <div>
                            <label style={styles.label}>
                              Banner 圖片網址 / 上傳
                            </label>
                            <input
                              value={meta.bannerUrl || ""}
                              onChange={(e) =>
                                updateStallMetaField(
                                  s.id,
                                  "bannerUrl",
                                  e.target.value
                                )
                              }
                              placeholder="貼 http(s) 連結或留空"
                              style={styles.input}
                            />
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                marginTop: 4,
                              }}
                            >
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={async (e) => {
                                  const file =
                                    e.target.files?.[0];
                                  if (!file) return;
                                  const dataUrl =
                                    await fileToDataUrl(
                                      file
                                    );
                                  updateStallMetaField(
                                    s.id,
                                    "bannerUrl",
                                    dataUrl
                                  );
                                }}
                              />
                              <span
                                style={{
                                  fontSize: 12,
                                  color: "#64748b",
                                }}
                              >
                                （上傳後會自動存為
                                data URL）
                              </span>
                            </div>
                            {meta.bannerUrl ? (
                              <img
                                src={meta.bannerUrl}
                                alt="banner"
                                style={{
                                  marginTop: 6,
                                  width: "100%",
                                  maxHeight: 100,
                                  objectFit: "cover",
                                  borderRadius: 8,
                                  border:
                                    "1px solid #e5e7eb",
                                }}
                              />
                            ) : null}
                          </div>

                          <div>
                            <label style={styles.label}>
                              主視覺圖片（商品合照等）
                            </label>
                            <input
                              value={meta.heroUrl || ""}
                              onChange={(e) =>
                                updateStallMetaField(
                                  s.id,
                                  "heroUrl",
                                  e.target.value
                                )
                              }
                              placeholder="貼 http(s) 連結或留空"
                              style={styles.input}
                            />
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                marginTop: 4,
                              }}
                            >
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={async (e) => {
                                  const file =
                                    e.target.files?.[0];
                                  if (!file) return;
                                  const dataUrl =
                                    await fileToDataUrl(
                                      file
                                    );
                                  updateStallMetaField(
                                    s.id,
                                    "heroUrl",
                                    dataUrl
                                  );
                                }}
                              />
                              <span
                                style={{
                                  fontSize: 12,
                                  color: "#64748b",
                                }}
                              >
                                （上傳後會自動存為
                                data URL）
                              </span>
                            </div>
                            {meta.heroUrl ? (
                              <img
                                src={meta.heroUrl}
                                alt="hero"
                                style={{
                                  marginTop: 6,
                                  width: "100%",
                                  maxHeight: 140,
                                  objectFit: "cover",
                                  borderRadius: 8,
                                  border:
                                    "1px solid #e5e7eb",
                                }}
                              />
                            ) : null}
                          </div>

                          <div>
                            <label style={styles.label}>
                              攤位介紹文字
                            </label>
                            <textarea
                              value={meta.intro || ""}
                              onChange={(e) =>
                                updateStallMetaField(
                                  s.id,
                                  "intro",
                                  e.target.value
                                )
                              }
                              rows={3}
                              style={{
                                ...styles.input,
                                minHeight: 60,
                                resize: "vertical",
                              }}
                              placeholder="簡單介紹這一攤賣什麼、特色說明…"
                            />
                          </div>

                          <div>
                            <label style={styles.label}>
                              特別規則 / 備註
                            </label>
                            <textarea
                              value={meta.rules || ""}
                              onChange={(e) =>
                                updateStallMetaField(
                                  s.id,
                                  "rules",
                                  e.target.value
                                )
                              }
                              rows={2}
                              style={{
                                ...styles.input,
                                minHeight: 48,
                                resize: "vertical",
                              }}
                              placeholder="例：本攤同口味需湊滿 60 包才開團…"
                            />
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 10,
                          }}
                        >
                          <button
                            onClick={() =>
                              saveStallCampaign(s.id)
                            }
                            disabled={saving}
                            style={styles.primaryBtn}
                          >
                            {saving
                              ? "儲存中…"
                              : "儲存此攤設定"}
                          </button>
                          <button
                            onClick={() =>
                              clearStallCampaign(s.id)
                            }
                            disabled={saving}
                            style={styles.secondaryBtn}
                          >
                            清除此攤設定
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 商品列表 */}
            <div style={{ padding: 16 }}>
              <div
                style={{
                  fontWeight: 900,
                  marginBottom: 8,
                }}
              >
                商品列表（全部商品）
              </div>
              {products.length === 0 ? (
                <div style={{ color: "#64748b" }}>
                  目前尚未有任何商品。
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    overflow: "hidden",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead
                      style={{
                        background: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      <tr>
                        <th style={th}>名稱</th>
                        <th style={th}>攤位 / 分類</th>
                        <th style={th}>原價</th>
                        <th style={th}>售價</th>
                        <th style={th}>可售總量</th>
                        <th style={th}>最低量</th>
                        <th style={th}>狀態</th>
                        <th style={th}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td style={td}>{p.name}</td>
                          <td style={td}>
                            {p.category || "-"}
                          </td>
                          <td style={tdRight}>
                            {p.original != null &&
                            p.original !== ""
                              ? fmt1(p.original)
                              : "-"}
                          </td>
                          <td style={tdRight}>{fmt1(p.price)}</td>
                          <td style={tdRight}>
                            {p.stockCapacity
                              ? fmt1(p.stockCapacity)
                              : "不限"}
                          </td>
                          <td style={tdRight}>
                            {p.minQty || 1}
                          </td>
                          <td style={td}>
                            {p.active === false ? "下架" : "上架中"}
                          </td>
                          <td style={td}>
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => startEdit(p)}
                                style={styles.smallBtn}
                              >
                                編輯
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(p.id)}
                                style={styles.dangerBtn}
                              >
                                刪除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* 其它分頁維持不變 */}
        {tab === "orders" && (
          <div style={{ padding: 8 }}>
            <AdminOrdersPanel />
          </div>
        )}

        {tab === "summary" && (
          <div style={{ padding: 8 }}>
            <AdminSummaryPanel />
          </div>
        )}

        {tab === "notice" && <AdminNoticePanel />}

        {tab === "payment" && <AdminPaymentInfo />}
      </div>
    </div>
  );
}

// ── 樣式 ────────────────────────────────────────────────
const styles = {
  wrap: {
    padding: 16,
    display: "grid",
    placeItems: "start center",
  },
  card: {
    width: "min(1100px, 96vw)",
    background: "rgba(255,255,255,.98)",
    border: "1px solid #eee",
    borderRadius: 16,
    boxShadow: "0 18px 36px rgba(0,0,0,.12)",
    overflow: "hidden",
  },
  header: {
    minHeight: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    borderBottom: "1px solid #eee",
    background: "#f9fafb",
    gap: 8,
  },
  title: { fontWeight: 800 },
  form: { padding: 16, display: "grid", gap: 8 },
  row: { display: "grid", gap: 6 },
  row2: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  label: {
    fontWeight: 800,
    fontSize: 12,
    color: "#333",
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #ddd",
    borderRadius: 10,
    background: "#fff",
    width: "100%",
    boxSizing: "border-box",
  },
  error: {
    color: "#b91c1c",
    fontSize: 12,
    marginTop: 4,
  },
  primaryBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "2px solid #16a34a",
    background: "#fff",
    color: "#16a34a",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 12,
  },
  secondaryBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "2px solid #9ca3af",
    background: "#fff",
    color: "#374151",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 12,
  },
  smallBtn: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
  },
  dangerBtn: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #b91c1c",
    background: "#fff",
    color: "#b91c1c",
    cursor: "pointer",
    fontSize: 12,
  },
};

// 表格 cell 樣式
const th = {
  textAlign: "left",
  padding: 8,
  borderBottom: "1px solid #e5e7eb",
};
const td = {
  padding: 8,
  borderBottom: "1px solid #f1f5f9",
};
const tdRight = {
  ...td,
  textAlign: "right",
};
