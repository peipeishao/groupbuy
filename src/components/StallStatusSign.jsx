// src/components/StallStatusSign.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase.js";
import { ref as dbRef, onValue } from "firebase/database";
import GroupStatusSign from "./GroupStatusSign.jsx";

export default function StallStatusSign({ stallId, titleOverride, style, hideTitle,rowGap, rowPaddingY, labelWidth, sectionGap, }) {
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (!stallId) return;
    const off = onValue(dbRef(db, `stalls/${stallId}`), snap => {
      const v = snap.val() || {};
      setMeta({
        title: titleOverride || String(v?.title || stallId),
        startAt: v?.campaign?.startAt ?? null,
        closeAt: v?.campaign?.closeAt ?? null,
        arriveAt: v?.campaign?.arriveAt ?? null,
      });
    });
    return () => off();
  }, [stallId, titleOverride]);

  if (!meta) return null;

  return (
    <div style={style}>
      <GroupStatusSign
        title={meta.title}
        openAt={meta.startAt}
        closeAt={meta.closeAt}
        arriveAt={meta.arriveAt}
        hideTitle={hideTitle}
        rowGap={rowGap}
        rowPaddingY={rowPaddingY}
        labelWidth={labelWidth}
        sectionGap={sectionGap}
      />
    </div>
  );
}
