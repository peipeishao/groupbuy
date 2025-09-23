// src/components/GroupStatusShelf.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase.js";
import { ref as dbRef, onValue } from "firebase/database";
import GroupStatusSign from "./GroupStatusSign.jsx";

export default function GroupStatusShelf() {
  const [stalls, setStalls] = useState([]);

  useEffect(() => {
    const off = onValue(dbRef(db, "stalls"), (snap) => {
      const v = snap.val() || {};
      const list = Object.entries(v).map(([id, s]) => ({
        id,
        title: String(s?.title || id),
        campaign: s?.campaign || null,
      }));
      list.sort((a, b) => String(a.title).localeCompare(String(b.title)));
      setStalls(list);
    });
    return () => off();
  }, []);

  if (!stalls.length) {
    return (
      <div style={wrap}>
        <div style={empty}>目前沒有攤位</div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={grid}>
        {stalls.map((s) => {
          const c = s.campaign || {};
          return (
            <GroupStatusSign
              key={s.id}
              title={s.title}
              openAt={c.startAt ?? null}
              closeAt={c.closeAt ?? null}
              arriveAt={c.arriveAt ?? null}
              style={{ width: "40%" }}
            />
          );
        })}
      </div>
    </div>
  );
}

const wrap = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#ffffff",
  padding: 12,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const empty = { padding: 12, color: "#6b7280" };
