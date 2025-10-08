// src/components/AdminPaymentInfo.jsx
import React from "react";
import { ref as dbRef, onValue, set, remove } from "firebase/database";
import { db } from "../firebase";
import { usePlayer } from "../store/playerContext.jsx";

export default function AdminPaymentInfo() {
  const player = (() => { try { return usePlayer(); } catch { return null; } })();
  const isAdmin = !!player?.isAdmin;

  const [qrUrl, setQrUrl] = React.useState("");
  const [file, setFile] = React.useState(null);
  const [pastedUrl, setPastedUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // 讀取現有收款 QR
  React.useEffect(() => {
    const off = onValue(dbRef(db, "config/payment"), (snap) => {
      const v = snap.val() || {};
      setQrUrl(v.qrUrl || "");
    });
    return () => off();
  }, []);

  // 檔案 → Data URL
  const fileToDataUrl = async (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(f); // 直接轉 data:image/...;base64,....
    });

  const save = async () => {
    if (!isAdmin) { alert("需要管理員權限"); return; }
    setSaving(true);
    try {
      let url = (pastedUrl || "").trim();

      if (file) {
        // 轉成 data URL 存 DB，不走 Firebase Storage
        url = await fileToDataUrl(file);
      }

      if (!url) { alert("請上傳圖片檔，或貼上圖片網址 / data:image"); setSaving(false); return; }

      // 基本檢查
      const ok =
        /^https?:\/\//i.test(url) ||
        /^data:image\/(png|jpeg|webp);base64,/i.test(url);
      if (!ok) {
        alert("格式不符：請使用 http(s) 圖片連結，或 data:image/png|jpeg|webp;base64,...");
        setSaving(false);
        return;
      }

      await set(dbRef(db, "config/payment"), {
        qrUrl: url.slice(0, 500000), // 與規則一致的上限
        updatedAt: Date.now(),
      });
      setFile(null);
      setPastedUrl("");
      alert("已更新收款 QR Code！");
    } catch (e) {
      console.error("[AdminPaymentInfo] save failed", e);
      alert("儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    if (!isAdmin) { alert("需要管理員權限"); return; }
    if (!window.confirm("確定清除收款 QR Code？")) return;
    try {
      await remove(dbRef(db, "config/payment"));
      setQrUrl("");
      setPastedUrl("");
      setFile(null);
    } catch (e) {
      console.error("[AdminPaymentInfo] clear failed", e);
      alert("清除失敗，請稍後再試");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>付款資訊</div>
      <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 12 }}>
        上傳圖片檔或貼上圖片網址（或 data:image）。儲存後將顯示在每位使用者的「訂購紀錄」視窗。
      </div>

      {/* 目前顯示 */}
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <div style={{ fontWeight: 800 }}>目前的 QR Code</div>
        {qrUrl ? (
          <img
            src={qrUrl}
            alt="收款 QR"
            style={{ width: 220, height: "auto", borderRadius: 12, border: "1px solid #eee" }}
          />
        ) : (
          <div style={{ color: "#6b7280" }}>尚未設定</div>
        )}
      </div>

      {/* 上傳或貼網址 */}
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>上傳圖片檔（將轉為 Data URL 存入 DB）</div>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>或貼上圖片網址 / Data URL</div>
          <input
            type="url"
            placeholder="https://example.com/your-qr.png 或 data:image/png;base64,..."
            value={pastedUrl}
            onChange={(e) => setPastedUrl(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10 }}
          />
          <div style={{ color: "#6b7280", fontSize: 12, marginTop: 6 }}>
            同時上傳與貼網址時，以「上傳的圖片」為準。
          </div>
        </div>
      </div>

      {/* 操作 */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: "10px 14px", borderRadius: 10, border: "2px solid #16a34a", background: "#fff", color: "#16a34a", fontWeight: 800, cursor: "pointer" }}
        >
          {saving ? "儲存中…" : "儲存"}
        </button>
        <button
          onClick={clearAll}
          style={{ padding: "10px 14px", borderRadius: 10, border: "2px solid #9ca3af", background: "#fff", color: "#374151", fontWeight: 800, cursor: "pointer" }}
        >
          清除
        </button>
      </div>
    </div>
  );
}
