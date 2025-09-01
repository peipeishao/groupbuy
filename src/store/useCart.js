// src/store/useCart.js
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import { onValue, ref, update, remove, serverTimestamp } from "firebase/database";
import { usePlayer } from "./playerContext.jsx";

const keyOf = (it) => `${it.stallId}|${it.id}`;

export function useCart() {
  const { uid } = usePlayer();
  const [itemsObj, setItemsObj] = useState({});

  useEffect(() => {
    if (!uid) return;
    const off = onValue(ref(db, `carts/${uid}`), (snap) => {
      const v = snap.val() || {};
      setItemsObj(v.items || {});
    });
    return () => off && off();
  }, [uid]);

  const items = useMemo(() => Object.values(itemsObj), [itemsObj]);
  const total = useMemo(
    () => items.reduce((s, x) => s + (x.price || 0) * (x.qty || 0), 0),
    [items]
  );

  const addToCart = async (itemWithQty) => {
    const k = keyOf(itemWithQty);
    const existing = itemsObj[k];
    const next = { ...itemWithQty, qty: (existing?.qty || 0) + itemWithQty.qty };
    await update(ref(db), {
      [`carts/${uid}/items/${k}`]: next,
      [`carts/${uid}/updatedAt`]: serverTimestamp(),
    });
  };

  const clearCart = async () => {
    await remove(ref(db, `carts/${uid}/items`));
    await update(ref(db), { [`carts/${uid}/updatedAt`]: serverTimestamp() });
  };

  return { items, total, addToCart, clearCart };
}

