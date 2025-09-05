// src/components/AdminPanel.jsx
import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase.js";
import { ref, push, onValue, update, remove } from "firebase/database";
import { usePlayer } from "../store/playerContext.jsx";

const STALL_PRESETS = [
  { id: "chicken", name: "雞胸肉" },
  { id: "cannele", name: "C文可麗露" },
];

// 數值與金額處理
function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function toMoney1(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0; }
const fmt1 = (n) => new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(n) || 0);
const ntd1 = (n)=> new Intl.NumberFormat("zh-TW",{style:"currency",currency:"TWD",minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(n)||0);

function toSlug(s) {
  return String(s || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}

// datetime-local <-> ms
const toInput = (ms) => {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(n);
  const pad = (x) => String(x).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromInput = (s) => {
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
};

const STATUS_OPTS = [
  { value: "ongoing", label: "開團中", color: "#f59e0b" }, // 黃
  { value: "shipped", label: "已發車", color: "#16a34a" }, // 綠
  { value: "ended",   label: "開團結束", color: "#94a3b8" }, // 灰
];

export default function AdminPanel() {
  let player = null;
  try { player = usePlayer(); } catch {}
  const isAdmin = !!player?.isAdmin;
  const uid = player?.uid || "";
  const roleName = player?.roleName || "Admin";

  // 商品管理狀態
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name:"", original:"", price:"", category:"chicken", imageUrl:"" });
  const [useCustomCat, setUseCustomCat] = useState(false);
  const [customCat, setCustomCat] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // 本次開團設定
  const [campaign, setCampaign] = useState({ status:"ongoing", closeAt:null, arriveAt:null });
  const [savingCampaign, setSavingCampaign] = useState(false);

  // 讀取產品
  useEffect(() => {
    const off = onValue(ref(db, "products"), (snap) => {
      const v = snap.val() || {};
      const list = Object.entries(v).map(([id, p]) => ({ id, ...p }));
      list.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0) || String(a.name).localeCompare(String(b.name)));
      setProducts(list);
    });
    return () => off();
  }, []);

  // 讀取 campaign/current
  useEffect(() => {
    const off = onValue(ref(db, "campaign/current"), (snap) => {
      const v = snap.val() || {};
      setCampaign({
        status: v.status || "ongoing",
        closeAt: v.closeAt ?? null,
        arriveAt: v.arriveAt ?? null,
      });
    });
    return () => off();
  }, []);

  // 類別清單
  const derivedCats = useMemo(() => {
    const s = new Set();
    for (const p of products) { const cat = String(p?.category || "").trim(); if (cat) s.add(cat); }
    return Array.from(s);
  }, [products]);

  const selectOptions = useMemo(() => {
    const dedup = new Map();
    for (const x of STALL_PRESETS) dedup.set(x.id, x.name);
    for (const id of derivedCats) if (!dedup.has(id)) dedup.set(id, id);
    return Array.from(dedup, ([id,name]) => ({ id, name }));
  }, [derivedCats]);

  function onChange(e){ const {name,value}=e.target; setForm((s)=>({ ...s, [name]:value })); }

  const validationMsg = useMemo(() => {
    const name = String(form.name||"").trim(); if (!name) return "請輸入商品名稱"; if (name.length>50) return "商品名稱請在 50 字以內";
    const price = toNumber(form.price), original = toNumber(form.original);
    if (price<=0) return "折扣價需為正數";
    if (original<0) return "原價不可為負數";
    if (original && price>original) return "折扣價不可高於原價";
    const img = String(form.imageUrl||"").trim(); if (img && !/^https?:\/\//i.test(img)) return "圖片網址需為 http(s) 連結";
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

    setLoading(true);
    try{
      const payload = {
        name: String(form.name||"").trim(),
        original: original1,
        price: price1,
        category: categoryFinal,
        imageUrl: String(form.imageUrl||"").trim() || null,
        updatedAt: Date.now(),
      };
      if (editingId){
        await update(ref(db, `products/${editingId}`), payload);
        setEditingId(null);
      } else {
        await push(ref(db,"products"), { ...payload, createdAt: Date.now(), createdBy:{ uid, roleName } });
      }
      setForm({ name:"", original:"", price:"", category: form.category || "chicken", imageUrl:"" });
      setUseCustomCat(false); setCustomCat("");
    } catch (e) { console.error("[AdminPanel] submit failed:",e); setErr("操作失敗，請稍後再試。"); }
    finally { setLoading(false); }
  }

  function startEdit(p){
    setEditingId(p.id);
    setForm({
      name: p.name || "",
      original: String(p.original ?? ""),
      price: String(p.price ?? ""),
      category: String(p.category || "chicken"),
      imageUrl: p.imageUrl || "",
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

  // 儲存「本次開團設定」
  const saveCampaign = async () => {
    if (!isAdmin) { alert("需要管理員權限"); return; }
    try{
      setSavingCampaign(true);
      await update(ref(db, "campaign/current"), {
        status: campaign.status || "ongoing",
        closeAt: campaign.closeAt ?? null,
        arriveAt: campaign.arriveAt ?? null,
        updatedAt: Date.now(),
      });
      alert("本次開團設定已更新！");
    }catch(e){
      console.error("[Campaign] save failed", e);
      alert("更新失敗，請稍後再試");
    }finally{
      setSavingCampaign(false);
    }
  };

  const statusMeta = STATUS_OPTS.find(s => s.value === campaign.status) || STATUS_OPTS[0];

  if (!isAdmin) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.header}><div style={styles.title}>團長後台：管理商品</div></div>
          <div style={{ padding: 16 }}>
            <div style={styles.notice}>
              需要管理員權限才能使用此頁面。請確認你的帳號在 <code>admins/{{uid}}</code> 下為 <code>true</code>。
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.header}><div style={styles.title}>團長後台：管理商品</div></div>

        {/* ✅ 本次開團設定 */}
        <div style={{ padding: 16, borderBottom: "1px solid #eee" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <div style={{ fontWeight:900 }}>本次開團設定</div>
            <span style={{ padding:"2px 8px", borderRadius:999, fontSize:12, fontWeight:900, background: statusMeta.color, color:"#fff" }}>
              {statusMeta.label}
            </span>
          </div>

          <div style={{ display:"grid", gap:10, gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))" }}>
            <div>
              <label style={styles.label}>收單時間</label>
              <input
                type="datetime-local"
                value={toInput(campaign.closeAt)}
                onChange={(e)=> setCampaign((s)=>({ ...s, closeAt: fromInput(e.target.value) }))}
                style={styles.input}
              />
              <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>讓大家知道什麼時候截止收單</div>
            </div>

            <div>
              <label style={styles.label}>發車狀態</label>
              <select
                value={campaign.status}
                onChange={(e)=> setCampaign((s)=>({ ...s, status: e.target.value }))}
                style={styles.input}
              >
                {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>開團中（黃）／ 已發車（綠）／ 開團結束（灰）</div>
            </div>

            <div>
              <label style={styles.label}>貨到時間</label>
              <input
                type="datetime-local"
                value={toInput(campaign.arriveAt)}
                onChange={(e)=> setCampaign((s)=>({ ...s, arriveAt: fromInput(e.target.value) }))}
                style={styles.input}
              />
              <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>若未定，可留空</div>
            </div>
          </div>

          <div style={{ marginTop:12 }}>
            <button onClick={saveCampaign} disabled={savingCampaign} style={styles.primaryBtn}>
              {savingCampaign ? "儲存中…" : "儲存本次開團設定"}
            </button>
          </div>
        </div>

        {/* 商品表單 */}
        <form onSubmit={onSubmit} style={styles.form}>
          <div style={styles.row}>
            <label style={styles.label}>商品名稱</label>
            <input name="name" value={form.name} onChange={onChange} placeholder="例如：舒肥雞胸" required style={styles.input} />
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
                <input value={customCat} onChange={(e)=> setCustomCat(e.target.value)} placeholder="例如：newstall 或 my-shop" style={styles.input} />
                <button type="button" onClick={()=> { setUseCustomCat(false); setCustomCat(""); }} style={styles.secondaryBtn}>取消自訂</button>
              </div>
            )}
            <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>
              前台會以 <code>category === stallId</code> 自動篩選顯示
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
              <button type="button" onClick={()=>{ setEditingId(null); setForm({ name:"", original:"", price:"", category:"chicken", imageUrl:"" }); setUseCustomCat(false); setCustomCat(""); }} style={styles.secondaryBtn}>取消編輯</button>
            )}
          </div>
        </form>

        {/* 商品清單 */}
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

      </div>
    </div>
  );
}

const styles = {
  wrap: { padding: 16, display: "grid", placeItems: "start center" },
  card: { width: "min(1100px, 96vw)", background: "rgba(255,255,255,.98)", border: "1px solid #eee", borderRadius: 16, boxShadow: "0 18px 36px rgba(0,0,0,.12)", overflow: "hidden" },
  header: { height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: "1px solid #eee", background: "#f9fafb" },
  title: { fontWeight: 800 },
  notice: { padding:16, background:"#fff8f0", border:"1px solid #fde68a", borderRadius:12, color:"#92400e", fontWeight:700 },
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
