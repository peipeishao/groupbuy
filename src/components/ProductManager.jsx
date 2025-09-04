// src/components/ProductManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db, storage } from "../firebase.js";
import { usePlayer } from "../store/playerContext.jsx";
import {
  ref as dbRef,
  onValue,
  push,
  set,
  update,
  remove,
} from "firebase/database";
import {
  ref as stRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

/* ---------- utils ---------- */
function safeKey(s) {
  // RTDB key 不能包含 . # $ [ ] /
  return String(s).trim().replace(/[.#$\[\]\/]/g, "_");
}
function toNumOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ---------- component ---------- */
export default function ProductManager({ onClose }) {
  const { isAdmin } = usePlayer();

  // 攤位
  const [stalls, setStalls] = useState({});
  const [stallId, setStallId] = useState("");
  const [newStallId, setNewStallId] = useState("");
  const [newStallTitle, setNewStallTitle] = useState("");
  const [creatingStall, setCreatingStall] = useState(false);

  // 新增商品
  const [name, setName] = useState("");
  const [priceOriginal, setPriceOriginal] = useState("");
  const [priceGroup, setPriceGroup] = useState("");
  const [unit, setUnit] = useState("包");
  const [stock, setStock] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // 商品列表
  const [products, setProducts] = useState({});
  const [editingId, setEditingId] = useState(null); // productId
  const [editForm, setEditForm] = useState({
    name: "",
    priceOriginal: "",
    priceGroup: "",
    unit: "包",
    stock: "",
    active: true,
    newImageFile: null,
    imageUrl: null,
  });
  const [showInactive, setShowInactive] = useState(true);

  /* ----- load stalls ----- */
  useEffect(() => {
    const r = dbRef(db, "stalls");
    return onValue(r, (snap) => {
      const v = snap.val() || {};
      setStalls(v);
      if (!stallId) {
        const first = Object.keys(v)[0];
        if (first) setStallId(first);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- load products of selected stall ----- */
  useEffect(() => {
    if (!stallId) {
      setProducts({});
      return;
    }
    const r = dbRef(db, `products/${stallId}`);
    return onValue(r, (snap) => setProducts(snap.val() || {}));
  }, [stallId]);

  const stallOptions = useMemo(
    () => Object.keys(stalls).map((id) => ({ id, title: stalls[id]?.title || id })),
    [stalls]
  );

  if (!isAdmin) {
    return (
      <div style={modalWrapStyle}>
        <div style={panelStyle}>
          <h3 style={{ margin: 0 }}>商品管理</h3>
          <p style={{ marginTop: 12 }}>你沒有權限。</p>
          <div style={{ textAlign: "right", marginTop: 12 }}>
            <button onClick={onClose} style={btnStyle}>關閉</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- actions ---------- */
  const handleCreateStall = async () => {
    if (!newStallId || !newStallTitle) {
      alert("請填寫【攤位 ID】與【攤位名稱】");
      return;
    }
    const id = safeKey(newStallId);
    setCreatingStall(true);
    try {
      await set(dbRef(db, `stalls/${id}`), {
        title: newStallTitle,
        description: "",
        coverUrl: null,
        active: true,
        createdAt: Date.now(),
      });
      setNewStallId("");
      setNewStallTitle("");
      setStallId(id);
      alert("已建立攤位");
    } catch (e) {
      console.error(e);
      alert("建立攤位失敗，請稍後再試");
    } finally {
      setCreatingStall(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!stallId) return alert("請先選擇攤位");
    if (!name.trim()) return alert("請輸入商品名稱");
    if (priceOriginal === "" || Number(priceOriginal) < 0) return alert("請輸入正確的原價");
    if (priceGroup === "" || Number(priceGroup) < 0) return alert("請輸入正確的團購價");
    if (unit.length > 10) return alert("單位字數太長（最多 10）");
    if (stock !== "" && Number(stock) < 0) return alert("庫存不可為負數");

    setSaving(true);
    try {
      const listRef = dbRef(db, `products/${stallId}`);
      const newRef = push(listRef);
      const productId = newRef.key;

      let imageUrl = null;
      if (imageFile) {
        const objectRef = stRef(storage, `products/${stallId}/${productId}/${imageFile.name}`);
        await uploadBytes(objectRef, imageFile);
        imageUrl = await getDownloadURL(objectRef);
      }

      await set(newRef, {
        id: productId,
        name: name.trim(),
        imageUrl,
        priceOriginal: Number(priceOriginal),
        priceGroup: Number(priceGroup),
        unit: unit || "包",
        stock: stock === "" ? null : Number(stock),
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // reset
      setName("");
      setPriceOriginal("");
      setPriceGroup("");
      setUnit("包");
      setStock("");
      setImageFile(null);

      alert("已新增商品！");
    } catch (e) {
      console.error(e);
      alert("新增失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (pid, p) => {
    setEditingId(pid);
    setEditForm({
      name: p.name || "",
      priceOriginal: String(p.priceOriginal ?? ""),
      priceGroup: String(p.priceGroup ?? ""),
      unit: p.unit || "包",
      stock: p.stock === null || p.stock === undefined ? "" : String(p.stock),
      active: !!p.active,
      imageUrl: p.imageUrl ?? null,
      newImageFile: null,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      name: "",
      priceOriginal: "",
      priceGroup: "",
      unit: "包",
      stock: "",
      active: true,
      imageUrl: null,
      newImageFile: null,
    });
  };

  const saveEdit = async () => {
    const pid = editingId;
    if (!pid) return;
    if (!stallId) return;
    if (!editForm.name.trim()) return alert("請輸入商品名稱");
    if (editForm.unit.length > 10) return alert("單位字數太長（最多 10）");

    const po = toNumOrNull(editForm.priceOriginal);
    const pg = toNumOrNull(editForm.priceGroup);
    if (po === null || po < 0) return alert("原價需為不小於 0 的數字");
    if (pg === null || pg < 0) return alert("團購價需為不小於 0 的數字");
    const st = toNumOrNull(editForm.stock);
    if (st !== null && st < 0) return alert("庫存不可為負數");

    let imageUrl = editForm.imageUrl ?? null;
    try {
      if (editForm.newImageFile) {
        const objectRef = stRef(storage, `products/${stallId}/${pid}/${editForm.newImageFile.name}`);
        await uploadBytes(objectRef, editForm.newImageFile);
        imageUrl = await getDownloadURL(objectRef);
      }

      await update(dbRef(db, `products/${stallId}/${pid}`), {
        name: editForm.name.trim(),
        imageUrl,
        priceOriginal: po,
        priceGroup: pg,
        unit: editForm.unit || "包",
        stock: st,
        active: !!editForm.active,
        updatedAt: Date.now(),
      });

      cancelEdit();
      alert("已更新商品");
    } catch (e) {
      console.error(e);
      alert("更新失敗，請稍後再試");
    }
  };

  const toggleActive = async (pid, current) => {
    if (!stallId) return;
    try {
      await update(dbRef(db, `products/${stallId}/${pid}`), {
        active: !current,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.error(e);
      alert("切換上下架失敗");
    }
  };

  const deleteProduct = async (pid) => {
    if (!stallId) return;
    if (!window.confirm("確定要刪除這個商品嗎？此動作無法復原。")) return;
    try {
      await remove(dbRef(db, `products/${stallId}/${pid}`));
    } catch (e) {
      console.error(e);
      alert("刪除失敗");
    }
  };

  /* ---------- render ---------- */
  return (
    <div style={modalWrapStyle} role="dialog" aria-modal="true" aria-label="商品管理">
      <div style={panelStyle}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0 }}>商品管理</h3>
          <button onClick={onClose} style={btnStyle}>關閉</button>
        </div>

        {/* 攤位選擇 + 快速新增攤位 */}
        <div style={sectionStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <div>
              <div style={labelStyle}>選擇攤位</div>
              <select value={stallId} onChange={(e) => setStallId(e.target.value)} style={inputStyle}>
                <option value="">— 請選擇 —</option>
                {stallOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}（{s.id}）
                  </option>
                ))}
              </select>
            </div>
            <div style={{ alignSelf: "end" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#555" }}>
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                顯示下架商品
              </label>
            </div>
          </div>

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #ddd" }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>快速新增攤位</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
              <input
                placeholder="攤位 ID（英數，會自動過濾不合法字元）"
                value={newStallId}
                onChange={(e) => setNewStallId(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="攤位名稱（顯示用）"
                value={newStallTitle}
                onChange={(e) => setNewStallTitle(e.target.value)}
                style={inputStyle}
              />
              <button onClick={handleCreateStall} disabled={creatingStall} style={btnPrimaryStyle}>
                {creatingStall ? "建立中…" : "建立攤位"}
              </button>
            </div>
          </div>
        </div>

        {/* 新增商品 */}
        <div style={sectionStyle}>
          <div style={labelStyle}>新增商品</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input placeholder="商品名稱（最多 50）" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} maxLength={50} />
            <input type="number" min="0" placeholder="原價" value={priceOriginal} onChange={(e) => setPriceOriginal(e.target.value)} style={inputStyle} />
            <input type="number" min="0" placeholder="團購價" value={priceGroup} onChange={(e) => setPriceGroup(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
            <input placeholder="單位（預設：包）" value={unit} onChange={(e) => setUnit(e.target.value)} style={inputStyle} maxLength={10} />
            <input type="number" min="0" placeholder="庫存（可留空）" value={stock} onChange={(e) => setStock(e.target.value)} style={inputStyle} />
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} style={inputStyle} />
          </div>
          <div style={{ marginTop: 10, textAlign: "right" }}>
            <button onClick={handleCreateProduct} disabled={saving || !stallId} style={btnPrimaryStyle}>
              {saving ? "儲存中…" : "新增商品"}
            </button>
          </div>
        </div>

        {/* 商品列表 */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={labelStyle}>商品列表（{stallId || "未選擇攤位"}）</div>
          </div>

          <div style={{ overflow: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>圖片</th>
                  <th style={thStyle}>名稱</th>
                  <th style={thStyle}>原價</th>
                  <th style={thStyle}>團購價</th>
                  <th style={thStyle}>單位</th>
                  <th style={thStyle}>庫存</th>
                  <th style={thStyle}>狀態</th>
                  <th style={thStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(products)
                  .filter((pid) => showInactive || products[pid]?.active)
                  .map((pid) => {
                    const p = products[pid];
                    const isEditing = editingId === pid;
                    return (
                      <tr key={pid}>
                        <td style={tdStyle}>
                          {isEditing ? (
                            <>
                              {editForm.imageUrl ? (
                                <img src={editForm.imageUrl} alt="" width={48} height={48} style={{ objectFit: "cover", borderRadius: 8, border: "1px solid #eee" }} />
                              ) : (
                                <div style={{ width: 48, height: 48, border: "1px dashed #ccc", borderRadius: 8, display: "grid", placeItems: "center", fontSize: 12, color: "#666" }}>無</div>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setEditForm((f) => ({ ...f, newImageFile: e.target.files?.[0] || null }))}
                                style={{ marginTop: 6 }}
                              />
                            </>
                          ) : p.imageUrl ? (
                            <img src={p.imageUrl} alt="" width={48} height={48} style={{ objectFit: "cover", borderRadius: 8, border: "1px solid #eee" }} />
                          ) : (
                            <div style={{ width: 48, height: 48, border: "1px dashed #ccc", borderRadius: 8, display: "grid", placeItems: "center", fontSize: 12, color: "#666" }}>無</div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          {isEditing ? (
                            <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} maxLength={50} />
                          ) : (
                            p.name
                          )}
                        </td>

                        <td style={tdStyle} width={110}>
                          {isEditing ? (
                            <input type="number" min="0" value={editForm.priceOriginal} onChange={(e) => setEditForm((f) => ({ ...f, priceOriginal: e.target.value }))} style={inputStyle} />
                          ) : (
                            p.priceOriginal
                          )}
                        </td>

                        <td style={tdStyle} width={110}>
                          {isEditing ? (
                            <input type="number" min="0" value={editForm.priceGroup} onChange={(e) => setEditForm((f) => ({ ...f, priceGroup: e.target.value }))} style={inputStyle} />
                          ) : (
                            p.priceGroup
                          )}
                        </td>

                        <td style={tdStyle} width={120}>
                          {isEditing ? (
                            <input value={editForm.unit} onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))} style={inputStyle} maxLength={10} />
                          ) : (
                            p.unit || "—"
                          )}
                        </td>

                        <td style={tdStyle} width={120}>
                          {isEditing ? (
                            <input type="number" min="0" value={editForm.stock} onChange={(e) => setEditForm((f) => ({ ...f, stock: e.target.value }))} style={inputStyle} />
                          ) : (
                            p.stock ?? "—"
                          )}
                        </td>

                        <td style={tdStyle} width={100}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 999,
                            border: "1px solid",
                            borderColor: p.active ? "#10b981" : "#9ca3af",
                            color: p.active ? "#065f46" : "#374151",
                            background: p.active ? "rgba(16,185,129,.12)" : "rgba(156,163,175,.15)",
                            fontSize: 12,
                            fontWeight: 700,
                          }}>
                            {p.active ? "上架" : "下架"}
                          </span>
                        </td>

                        <td style={tdStyle} width={240}>
                          {isEditing ? (
                            <>
                              <button onClick={saveEdit} style={btnPrimaryStyle}>儲存</button>
                              <button onClick={cancelEdit} style={{ ...btnStyle, marginLeft: 8 }}>取消</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(pid, p)} style={btnPrimaryStyle}>編輯</button>
                              <button onClick={() => toggleActive(pid, p.active)} style={{ ...btnStyle, marginLeft: 8 }}>
                                {p.active ? "下架" : "上架"}
                              </button>
                              <button onClick={() => deleteProduct(pid)} style={{ ...btnDangerStyle, marginLeft: 8 }}>刪除</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                {Object.keys(products).length === 0 && (
                  <tr>
                    <td style={{ ...tdStyle, textAlign: "center" }} colSpan={8}>（此攤位尚無商品）</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- styles ---------- */
const modalWrapStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.35)",
  display: "grid",
  placeItems: "center",
  zIndex: 80,
};

const panelStyle = {
  width: 960,
  maxWidth: "96vw",
  maxHeight: "92vh",
  overflow: "auto",
  background: "rgba(255,255,255,.98)",
  borderRadius: 16,
  border: "1px solid #eee",
  boxShadow: "0 12px 28px rgba(0,0,0,.22)",
  padding: 16,
};

const sectionStyle = {
  marginTop: 12,
  padding: 12,
  border: "1px solid #eee",
  borderRadius: 12,
  background: "rgba(250,250,250,.9)",
};

const labelStyle = { fontSize: 12, color: "#666", marginBottom: 6 };

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
};

const btnStyle = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "2px solid #333",
  background: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const btnPrimaryStyle = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "2px solid #1d4ed8",
  background: "#fff",
  color: "#1d4ed8",
  fontWeight: 800,
  cursor: "pointer",
};

const btnDangerStyle = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "2px solid #dc2626",
  background: "#fff",
  color: "#dc2626",
  fontWeight: 800,
  cursor: "pointer",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: 14,
};

const thStyle = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #eee",
  position: "sticky",
  top: 0,
  background: "rgba(255,255,255,.96)",
  zIndex: 1,
};

const tdStyle = {
  padding: "10px 8px",
  borderBottom: "1px solid #f0f0f0",
};
