// src/components/RememberedAccounts.jsx
import React, { useMemo, useState } from "react";

const LS_KEY = "gb.rememberedAccounts"; // [{email, display, avatar, lastLoginAt}]

export function loadRememberedAccounts() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));
  } catch {
    return [];
  }
}

export function addRememberedAccount({ email, display, avatar }) {
  if (!email) return;
  try {
    const arr = loadRememberedAccounts().filter((x) => x.email !== email);
    arr.unshift({
      email,
      display: display || email.split("@")[0] || "使用者",
      avatar: avatar || "🙂",
      lastLoginAt: Date.now(),
    });
    localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, 8)));
  } catch {}
}

export function removeRememberedAccount(email) {
  if (!email) return;
  try {
    const arr = loadRememberedAccounts().filter((x) => x.email !== email);
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch {}
}

export function clearRememberedAccounts() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

export default function RememberedAccounts({ onSelect }) {
  const [ver, setVer] = useState(0);
  const accounts = useMemo(() => loadRememberedAccounts(), [ver]);

  if (!accounts.length) return null;

  const refresh = () => setVer((v) => v + 1);

  return (
    <div
      style={{
        marginTop: 12,
        background: "rgba(255,255,255,.95)",
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <div style={{ fontWeight: 800 }}>快速登入</div>
        <button
          onClick={() => { clearRememberedAccounts(); refresh(); }}
          style={{ fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
          title="清空所有記住的帳號"
        >
          清空
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 8,
        }}
      >
        {accounts.map((acc) => (
          <div key={acc.email} style={{ position: "relative" }}>
            <button
              onClick={() => onSelect?.(acc)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: "pointer",
                textAlign: "left",
              }}
              title={`以 ${acc.email} 登入`}
            >
              <span style={{ fontSize: 22 }}>{acc.avatar || "🙂"}</span>
              <span>
                <div style={{ fontWeight: 700 }}>
                  {acc.display || acc.email.split("@")[0]}
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>{acc.email}</div>
              </span>
            </button>

            {/* 刪除按鈕 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeRememberedAccount(acc.email);
                refresh();
              }}
              aria-label="刪除此帳號"
              title="刪除此帳號"
              style={{
                position: "absolute",
                top: -8,
                right: -8,
                width: 24,
                height: 24,
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,.06)",
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
