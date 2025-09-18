// src/components/AdminPanel.jsx
import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase.js";
import { ref, push, onValue, update, remove } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";
import AdminOrdersPanel from "./AdminOrdersPanel.jsx";

// ── 工具 & 常數 ─────────────────────────────────────────
const fmt1 = (n) =>
  new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(n) || 0);
const ntd1 = (n)=>
  new Intl.NumberFormat("zh-TW",{style:"currency",currency:"TWD",minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(n)||0);

function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function toInt(v, def=0){ const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : def; }
function toMoney1(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0; }
function toSlug(s) { return String(s || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32); }

// datetime-local <-> ms
const toInput = (ms) => {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(n);
  const pad = (x) => String(x).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromInput = (s) => { const t = Date.parse(s); return Number.isFinite(t) ? t : null; };

const STATUS_OPTS = [
  { value: "upcoming", label: "尚未開始", color: "#3b82f6" }, // 藍
  { value: "ongoing",  label: "開團中",   color: "#f59e0b" }, // 黃
  { value: "shipped",  label: "開團成功", color: "#16a34a" }, // 綠
  { value: "ended",    label: "開團結束", color: "#94a3b8" }, // 灰
];

// ── 元件 ────────────────────────────────────────────────
export default function AdminPanel() {
  let player = null;
  try { player = usePlayer(); } catch {}
  const isAdmin = !!player?.isAdmin;
  const uid = player?.uid || "";
  const roleName = player?.roleName || "Admin";

  // 分頁（商品 / 訂單）
  const [tab, setTab] = useState("products");
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
    >{label}</button>
  );

  // 商品管理狀態
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    name:"", original:"", price:"", category:"chicken", imageUrl:"",
    stockCapacity:"",  // ✅ 可售總量（0 或空 = 不限制）
    minQty:"1",        // ✅ 每筆最低下單量
  });
  const [useCustomCat, setUseCustomCat] = useState(false);
  const [customCat, setCustomCat] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ❶ 讀取產品
  useEffect(() => {
    const off = onValue(ref(db, "products"), (snap) => {
      const v = snap.val() || {};
      const list = Object.entries(v).map(([id, p]) => ({ id, ...p }));
      list.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0) || String(a.name).localeCompare(String(b.name)));
      setProducts(list);
    });
    return () => off();
  }, []);

  // ❷ 讀取所有攤位（用於「每攤位開團設定」）
  const [stalls, setStalls] = useState([]); // [{id, title, campaign?}]
  useEffect(() => {
    const off = onValue(ref(db, "stalls"), (snap) => {
      const v = snap.val() || {};
      const list = Object.entries(v).map(([id, s]) => ({
        id,
        title: String(s?.title || id),
        campaign: s?.campaign || null,
      }));
      list.sort((a,b)=> String(a.title).localeCompare(String(b.title)));
      setStalls(list);
    });
    return () => off();
  }, []);

  // ❸ 將 products 的 category 視為候選「攤位/分類」
  const derivedCats = useMemo(() => {
    const s = new Set();
    for (const p of products) { const cat = String(p?.category || "").trim(); if (cat) s.add(cat); }
    return Array.from(s);
  }, [products]);
  const selectOptions = useMemo(() => {
    // 將現有 /stalls 與 categories 合併成選單（給新增商品選擇）
    const dedup = new Map();
    for (const st of stalls) dedup.set(st.id, st.title);
    for (const id of derivedCats) if (!dedup.has(id)) dedup.set(id, id);
    return Array.from(dedup, ([id,name]) => ({ id, name }));
  }, [stalls, derivedCats]);

  function onChange(e){ const {name,value}=e.target; setForm((s)=>({ ...s, [name]:value })); }

  // ✅ 驗證：含庫存與最低量
  const validationMsg = useMemo(() => {
    const name = String(form.name||"").trim(); if (!name) return "請輸入商品名稱"; if (name.length>50) return "商品名稱請在 50 字以內";
    const price = toNumber(form.price), original = toNumber(form.original);
    if (price<=0) return "折扣價需為正數";
    if (original<0) return "原價不可為負數";
    if (original && price>original) return "折扣價不可高於原價";

    const img = String(form.imageUrl||"").trim();
    if (img && !/^https?:\/\//i.test(img)) return "圖片網址需為 http(s) 連結";

    const cap = form.stockCapacity==="" ? 0 : toInt(form.stockCapacity, -1);
    if (cap<0) return "可售總量需為不小於 0 的整數（空白或 0 表示不限制）";

    const minQ = toInt(form.minQty, 1);
    if (minQ<1) return "每筆最低下單量需為 ≥1 的整數";

    if (useCustomCat) { const slug = toSlug(customCat); if(!slug) return "請輸入自訂分類（英數小寫，可含 - _）"; }
    else if (!form.category) return "請選擇分類";

    return "";
  }, [form,useCustomCat,customCat]);

  async function onSubmit(e){
    e?.preventDefault?.();
    setErr("");
    if (!isAdmin) { setErr("需要管理員權限"); return; }
    if (validationMsg) { setErr(validationMsg); return; }

    const categoryFinal = useCustomCat ? toSlug(customCat) : String(form.category);
    const price1 = toMoney1(form.price);
    const original1 = toMoney1(form.original);
    const cap = form.stockCapacity==="" ? 0 : toInt(form.stockCapacity, 0); // 0=不限制
    const minQ = toInt(form.minQty, 1);

    setLoading(true);
    try{
      const payload = {
        name: String(form.name||"").trim(),
        original: original1,
        price: price1,
        category: categoryFinal,
        imageUrl: String(form.imageUrl||"").trim() || null,
        stockCapacity: cap,   // ✅ 可售總量（0 表示不限制）
        minQty: minQ,         // ✅ 每筆最低下單量
        updatedAt: Date.now(),
      };
      if (editingId){
        await update(ref(db, `products/${editingId}`), payload);
        setEditingId(null);
      } else {
        await push(ref(db,"products"), { ...payload, createdAt: Date.now(), createdBy:{ uid, roleName } });
      }
      setForm({
        name:"", original:"", price:"", category: form.category || "chicken", imageUrl:"",
        stockCapacity:"", minQty:"1",
      });
      setUseCustomCat(false); setCustomCat("");
    } catch (e) {
      console.error("[AdminPanel] submit failed:",e);
      setErr("操作失敗，請稍後再試。");
    } finally { setLoading(false); }
  }

  function startEdit(p){
    setEditingId(p.id);
    setForm({
      name: p.name || "",
      original: String(p.original ?? ""),
      price: String(p.price ?? ""),
      category: String(p.category || "chicken"),
      imageUrl: p.imageUrl || "",
      stockCapacity: String(p.stockCapacity ?? ""), // ✅
      minQty: String(p.minQty ?? "1"),              // ✅
    });
    setUseCustomCat(false); setCustomCat("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onDelete(id){
    if (!isAdmin) { setErr("需要管理員權限"); return; }
    if (!window.confirm("確定要刪除這個商品嗎？")) return;
    setLoading(true); setErr("");
    try{ await remove(ref(db, `products/${id}`)); }
    catch(e){ console.error("[AdminPanel] delete failed:",e); setErr("刪除失敗，請稍後再試。"); }
    finally{ setLoading(false); }
  }

  // ── 每攤位開團設定：本地可編輯狀態（避免直接動到 RTDB） ──
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
      [stallId]: { ...(prev[stallId] || {}), [key]: value }
    }));
  };

  const saveStallCampaign = async (stallId) => {
    const c = editingStallCamp[stallId];
    if (!c) return;
    setSavingStallId(stallId);
    try {
      await update(ref(db, `stalls/${stallId}/campaign`), {
        status: c.status || "ongoing",
        startAt: c.startAt ?? null,
        closeAt: c.closeAt ?? null,
        arriveAt: c.arriveAt ?? null,
        updatedAt: Date.now(),
      });
      alert(`已更新「${stallId}」的開團設定！`);
    } catch (e) {
      console.error("[saveStallCampaign] failed", e);
      alert("儲存失敗，請稍後再試");
    } finally {
      setSavingStallId("");
    }
  };

  const clearStallCampaign = async (stallId) => {
    if (!window.confirm(`確定要清除攤位「${stallId}」的開團設定嗎？`)) return;
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

  // ── UI ────────────────────────────────────────────────
  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        {/* 標題 + 分頁切換 */}
        <div style={styles.header}>
          <div style={styles.title}>團長後台：管理中心</div>
          <div style={{ display:"flex", gap:8 }}>
            {tabBtn("products", "管理商品 / 每攤位開團設定")}
            {tabBtn("orders", "管理訂單")}
          </div>
        </div>

        {/* ── Products 分頁 ─────────────────────────────── */}
        {tab === "products" && (
          <>
            {/* 每攤位開團設定 */}
            <div style={{ padding: 16, borderBottom: "1px solid #eee", background:"#f8fafc" }}>
              <div style={{ fontWeight:900, marginBottom: 10 }}>每攤位開團設定</div>

              {stalls.length === 0 ? (
                <div style={{ color:"#64748b" }}>尚未建立任何攤位（stalls）。</div>
              ) : (
                <div style={{ display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))" }}>
                  {stalls.map((s) => {
                    const c = editingStallCamp[s.id] || {};
                    const saving = savingStallId === s.id;
                    return (
                      <div key={s.id} style={{ border:"1px solid #e5e7eb", borderRadius:12, background:"#fff", padding:12 }}>
                        <div style={{ fontWeight:900, marginBottom:8 }}>
                          {s.title} <span style={{ color:"#94a3b8" }}>（{s.id}）</span>
                        </div>

                        <div style={{ display:"grid", gap:8 }}>
                          <div>
                            <label style={styles.label}>狀態</label>
                            <select
                              value={c.status || "ongoing"}
                              onChange={(e)=> updateField(s.id, "status", e.target.value)}
                              style={styles.input}
                            >
                              {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>

                          <div>
                            <label style={styles.label}>開團開始時間（可留空）</label>
                            <input
                              type="datetime-local"
                              value={toInput(c.startAt)}
                              onChange={(e)=> updateField(s.id, "startAt", fromInput(e.target.value))}
                              style={styles.input}
                            />
                          </div>

                          <div>
                            <label style={styles.label}>收單截止時間</label>
                            <input
                              type="datetime-local"
                              value={toInput(c.closeAt)}
                              onChange={(e)=> updateField(s.id, "closeAt", fromInput(e.target.value))}
                              style={styles.input}
                            />
                          </div>

                          <div>
                            <label style={styles.label}>貨到時間（可留空）</label>
                            <input
                              type="datetime-local"
                              value={toInput(c.arriveAt)}
                              onChange={(e)=> updateField(s.id, "arriveAt", fromInput(e.target.value))}
                              style={styles.input}
                            />
                          </div>
                        </div>

                        <div style={{ display:"flex", gap:8, marginTop:10 }}>
                          <button onClick={()=> saveStallCampaign(s.id)} disabled={saving} style={styles.primaryBtn}>
                            {saving ? "儲存中…" : "儲存此攤設定"}
                          </button>
                          <button onClick={()=> clearStallCampaign(s.id)} disabled={saving} style={styles.secondaryBtn}>
                            清除此攤設定
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 商品表單：✅ 新增 可售總量 / 最低下單量 */}
            <form onSubmit={onSubmit} style={styles.form}>
              <div style={styles.row}>
                <label style={styles.label}>商品名稱</label>
                <input name="name" value={form.name} onChange={onChange} placeholder="例如：C文可麗露｜原味" required style={styles.input} />
              </div>

              <div style={styles.row2}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>原價</label>
                  <input name="original" type="number" min="0" step="0.1" value={form.original} onChange={onChange} placeholder="例如：80.0" required style={styles.input} />
                </div>
                <div style={{ width: 12 }} />
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>折扣價</label>
                  <input name="price" type="number" min="0.1" step="0.1" value={form.price} onChange={onChange} placeholder="例如：50.0" required style={styles.input} />
                </div>
              </div>

              <div style={styles.row2}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>可售總量（上限）</label>
                  <input
                    name="stockCapacity"
                    type="number"
                    min="0"
                    step="1"
                    value={form.stockCapacity}
                    onChange={onChange}
                    placeholder="例如：80（空白或 0＝不限制）"
                    style={styles.input}
                  />
                </div>
                <div style={{ width: 12 }} />
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>每筆最低下單量</label>
                  <input
                    name="minQty"
                    type="number"
                    min="1"
                    step="1"
                    value={form.minQty}
                    onChange={onChange}
                    placeholder="例如：2"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.row}>
                <label style={styles.label}>分類 / 攤位</label>
                {!useCustomCat ? (
                  <div style={{ display:"flex", gap:8 }}>
                    <select name="category" value={form.category} onChange={onChange} style={{ ...styles.input, width:"auto", minWidth: 220 }}>
                      {selectOptions.map((o)=> <option key={o.id} value={o.id}>{o.name}（{o.id}）</option>)}
                    </select>
                    <button type="button" onClick={()=> setUseCustomCat(true)} style={styles.smallBtn}>自訂分類…</button>
                  </div>
                ) : (
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <input value={customCat} onChange={(e)=> setCustomCat(e.target.value)} placeholder="例如：cannele 或 chicken" style={styles.input} />
                    <button type="button" onClick={()=> { setUseCustomCat(false); setCustomCat(""); }} style={styles.secondaryBtn}>取消自訂</button>
                  </div>
                )}
                <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>
                  建議：C文可麗露每種口味各建一個商品（原味 / 可可），並把「可售總量」設 80、「最低下單量」設 2。
                </div>
              </div>

              <div style={styles.row}>
                <label style={styles.label}>圖片網址（選填）</label>
                <input name="imageUrl" value={form.imageUrl} onChange={onChange} placeholder="例如：https://..." style={styles.input} />
              </div>

              {err && <div style={styles.error}>{err}</div>}

              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <button type="submit" disabled={loading} style={styles.primaryBtn}>{loading ? "處理中…" : editingId ? "更新商品" : "新增商品"}</button>
                {editingId && (
                  <button type="button" onClick={()=>{ setEditingId(null); setForm({ name:"", original:"", price:"", category:"chicken", imageUrl:"", stockCapacity:"", minQty:"1" }); setUseCustomCat(false); setCustomCat(""); }} style={styles.secondaryBtn}>取消編輯</button>
                )}
              </div>
            </form>

            {/* 商品清單（顯示上限/最低量） */}
            <div style={{ marginTop: 16 }}>
              {products.length === 0 ? (
                <div style={{ textAlign:"center", color:"#666", padding:16 }}>目前沒有任何商品，請新增。</div>
              ) : (
                <div style={{ display:"grid", gap:8 }}>
                  {products.map((p)=>(
                    <div key={p.id} style={styles.item}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} style={{ width:56,height:56,objectFit:"cover",borderRadius:8,border:"1px solid #eee" }} />
                        ) : (
                          <div style={{ width:56,height:56,borderRadius:8,border:"1px solid #eee",display:"grid",placeItems:"center",color:"#999" }}>無圖</div>
                        )}
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontWeight:800, whiteSpace:"nowrap", textOverflow:"ellipsis", overflow:"hidden" }}>{p.name}</div>
                          <div style={{ fontSize:12, color:"#666" }}>
                            分類：{p.category || "（未指定）"} ｜ {ntd1(p.price)}
                            {p.original ? (<span style={{ marginLeft:6, textDecoration:"line-through", color:"#999" }}>{ntd1(p.original)}</span>) : null}
                          </div>
                          <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>
                            可售總量：<b>{p.stockCapacity ?? 0}</b>　|　每筆最低：<b>{p.minQty ?? 1}</b>
                          </div>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={()=> startEdit(p)} style={styles.smallBtn}>編輯</button>
                        <button onClick={()=> onDelete(p.id)} style={styles.dangerBtn}>刪除</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Orders 分頁 ──────────────────────────────── */}
        {tab === "orders" && (
          <div style={{ padding: 8 }}>
            <AdminOrdersPanel />
          </div>
        )}
      </div>
    </div>
  );
}

// ── 樣式 ────────────────────────────────────────────────
const styles = {
  wrap: { padding: 16, display: "grid", placeItems: "start center" },
  card: { width: "min(1100px, 96vw)", background: "rgba(255,255,255,.98)", border: "1px solid #eee", borderRadius: 16, boxShadow: "0 18px 36px rgba(0,0,0,.12)", overflow: "hidden" },
  header: { height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: "1px solid #eee", background: "#f9fafb" },
  title: { fontWeight: 800 },
  form: { padding: 16, display: "grid", gap: 8 },
  row: { display: "grid", gap: 6 },
  row2: { display: "flex", gap: 0 },
  label: { fontWeight: 800, fontSize: 12, color: "#333" },
  input: { padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, background: "#fff", width: "100%" },
  error: { color: "#b91c1c", fontSize: 12, marginTop: 4 },
  primaryBtn: { padding: "10px 14px", borderRadius: 10, border: "2px solid #16a34a", background: "#fff", color: "#16a34a", fontWeight: 800, cursor: "pointer" },
  secondaryBtn: { padding: "10px 14px", borderRadius: 10, border: "2px solid #9ca3af", background: "#fff", color: "#374151", fontWeight: 800, cursor: "pointer" },
  smallBtn: { padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontWeight: 800, cursor: "pointer" },
  dangerBtn: { padding: "6px 10px", borderRadius: 10, border: "2px solid #ef4444", background: "#fff", color: "#ef4444", fontWeight: 800, cursor: "pointer" },
  item: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1px solid #eee", borderRadius: 12, padding: 10 },
};
