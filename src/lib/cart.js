import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { recordCustomerInterest } from './customerPreferences';

const GUEST_KEY = 'balqees-store-cart-v1';
const EVT = 'balqees-cart-change';
const userKey = userId => `${GUEST_KEY}:${userId}`;

function normalizeItem(item = {}) {
  if (!item?.product_id) return null;
  return {
    product_id: String(item.product_id),
    quantity: Math.max(0, Number(item.quantity || 0)),
    is_gift: !!item.is_gift,
    unit_price_snapshot: item.unit_price_snapshot === null || item.unit_price_snapshot === undefined || item.unit_price_snapshot === '' ? null : Number(item.unit_price_snapshot),
    price_snapshot_at: item.price_snapshot_at || null,
    updated_at: item.updated_at || null,
  };
}

function readKey(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw.map(normalizeItem).filter(Boolean).filter(x => x.quantity > 0) : [];
  } catch {
    return [];
  }
}

function writeKey(key, items) {
  const cleaned = (items || []).map(normalizeItem).filter(Boolean).filter(x => x.quantity > 0);
  localStorage.setItem(key, JSON.stringify(cleaned));
  window.dispatchEvent(new CustomEvent(EVT, { detail: { key } }));
  return cleaned;
}

function timeOf(value) {
  const t = value ? new Date(value).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function mergeItems(...groups) {
  const map = new Map();
  groups.flat().forEach(raw => {
    const item = normalizeItem(raw);
    if (!item || item.quantity <= 0) return;
    const existing = map.get(item.product_id);
    if (!existing) {
      map.set(item.product_id, item);
      return;
    }
    const existingTime = timeOf(existing.updated_at);
    const itemTime = timeOf(item.updated_at);
    if (itemTime > existingTime) map.set(item.product_id, item);
    else if (itemTime === existingTime && item.quantity !== existing.quantity) map.set(item.product_id, { ...existing, quantity: Math.max(existing.quantity, item.quantity) });
  });
  return [...map.values()];
}

function remoteShape(userId, item) {
  return {
    user_id: userId,
    product_id: item.product_id,
    quantity: Number(item.quantity || 1),
    is_gift: !!item.is_gift,
    unit_price_snapshot: item.unit_price_snapshot,
    price_snapshot_at: item.price_snapshot_at,
    updated_at: item.updated_at || new Date().toISOString(),
  };
}

export function useBalqeesCart(userId = null) {
  const key = userId ? userKey(userId) : GUEST_KEY;
  const [items, setItems] = useState(() => readKey(key));
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const syncLocal = event => {
      const changedKey = event?.detail?.key;
      if (changedKey && changedKey !== key) return;
      setItems(readKey(key));
    };
    const syncStorage = event => {
      if (event.key && event.key !== key) return;
      setItems(readKey(key));
    };
    window.addEventListener(EVT, syncLocal);
    window.addEventListener('storage', syncStorage);
    setItems(readKey(key));
    return () => {
      window.removeEventListener(EVT, syncLocal);
      window.removeEventListener('storage', syncStorage);
    };
  }, [key]);

  useEffect(() => {
    if (!userId || !supabase) {
      setSynced(false);
      return undefined;
    }
    let live = true;
    setSyncing(true);
    (async () => {
      const [remoteResult] = await Promise.all([
        supabase.from('customer_cart_items').select('product_id,quantity,is_gift,unit_price_snapshot,price_snapshot_at,updated_at').eq('user_id', userId),
      ]);
      if (!live) return;
      if (remoteResult.error) {
        setSyncing(false);
        return;
      }
      const guest = readKey(GUEST_KEY);
      const personal = readKey(userKey(userId));
      const remote = (remoteResult.data || []).map(normalizeItem).filter(Boolean);
      const merged = mergeItems(remote, personal, guest);
      const now = new Date().toISOString();
      const withDates = merged.map(item => ({ ...item, updated_at: item.updated_at || now }));
      writeKey(userKey(userId), withDates);
      if (guest.length) localStorage.removeItem(GUEST_KEY);
      setItems(withDates);
      if (withDates.length) {
        await supabase.from('customer_cart_items').upsert(withDates.map(item => remoteShape(userId, item)), { onConflict: 'user_id,product_id' });
      }
      setSyncing(false);
      setSynced(true);
    })();
    return () => { live = false; };
  }, [userId]);

  const count = useMemo(() => items.reduce((n, x) => n + Number(x.quantity || 0), 0), [items]);

  function persist(next, remoteTask) {
    const stamped = next.map(item => ({ ...item, updated_at: item.updated_at || new Date().toISOString() }));
    writeKey(key, stamped);
    setItems(stamped);
    if (userId && supabase && remoteTask) Promise.resolve(remoteTask(stamped)).catch(() => {});
  }

  function add(product, quantity = 1, meta = {}) {
    if (!product?.id) return;
    const current = readKey(key);
    const idx = current.findIndex(x => x.product_id === String(product.id));
    const min = Number(product.min_order_quantity || 1);
    const stockMax = product.stock_mode === 'tracked' ? Number(product.stock_quantity || 0) : Infinity;
    const configuredMax = product.max_order_quantity ? Number(product.max_order_quantity) : Infinity;
    const max = Math.min(stockMax, configuredMax);
    const qty = Math.min(max, Math.max(min, Number(quantity || min)));
    const now = new Date().toISOString();
    if (idx >= 0) {
      current[idx] = {
        ...current[idx],
        quantity: Math.min(max, Number(current[idx].quantity || 0) + qty),
        is_gift: meta.is_gift === undefined ? current[idx].is_gift : !!meta.is_gift,
        unit_price_snapshot: meta.unit_price_snapshot ?? current[idx].unit_price_snapshot ?? null,
        price_snapshot_at: meta.unit_price_snapshot !== undefined && meta.unit_price_snapshot !== null ? now : current[idx].price_snapshot_at,
        updated_at: now,
      };
    } else {
      current.push({
        product_id: String(product.id),
        quantity: qty,
        is_gift: !!meta.is_gift,
        unit_price_snapshot: meta.unit_price_snapshot ?? null,
        price_snapshot_at: meta.unit_price_snapshot !== undefined && meta.unit_price_snapshot !== null ? now : null,
        updated_at: now,
      });
    }
    persist(current, async next => {
      const item = next.find(x => x.product_id === String(product.id));
      if (item) await supabase.from('customer_cart_items').upsert(remoteShape(userId, item), { onConflict: 'user_id,product_id' });
    });
    if (idx < 0 && userId && supabase) {
      recordCustomerInterest({
        user_id: userId,
        event_type: 'cart_add',
        product_id: product.id,
        category_id: product.category_id || null,
        metadata: { source: 'cart' },
      });
    }
  }

  function update(productId, quantity, product = null) {
    const id = String(productId);
    const current = readKey(key);
    const min = Number(product?.min_order_quantity || 1);
    const stockMax = product?.stock_mode === 'tracked' ? Number(product.stock_quantity || 0) : Infinity;
    const configuredMax = product?.max_order_quantity ? Number(product.max_order_quantity) : Infinity;
    const max = Math.min(stockMax, configuredMax);
    const qty = Math.min(max, Math.max(min, Number(quantity || min)));
    const now = new Date().toISOString();
    const next = current.map(x => x.product_id === id ? { ...x, quantity: qty, updated_at: now } : x);
    persist(next, async rows => {
      const item = rows.find(x => x.product_id === id);
      if (item) await supabase.from('customer_cart_items').upsert(remoteShape(userId, item), { onConflict: 'user_id,product_id' });
    });
  }

  function remove(productId) {
    const id = String(productId);
    const next = readKey(key).filter(x => x.product_id !== id);
    persist(next, async () => {
      await supabase.from('customer_cart_items').delete().eq('user_id', userId).eq('product_id', id);
    });
    if (userId && supabase) {
      recordCustomerInterest({
        user_id: userId,
        event_type: 'cart_remove',
        product_id: id,
        metadata: { source: 'cart' },
      });
    }
  }

  function clear() {
    writeKey(key, []);
    setItems([]);
    if (userId && supabase) supabase.from('customer_cart_items').delete().eq('user_id', userId).then(() => {});
  }

  function setGift(isGift) {
    const now = new Date().toISOString();
    const next = readKey(key).map(item => ({ ...item, is_gift: !!isGift, updated_at: now }));
    persist(next, async rows => {
      if (rows.length) await supabase.from('customer_cart_items').upsert(rows.map(item => remoteShape(userId, item)), { onConflict: 'user_id,product_id' });
    });
  }

  function setPriceSnapshot(productId, unitPrice) {
    const id = String(productId);
    const now = new Date().toISOString();
    const next = readKey(key).map(item => item.product_id === id ? {
      ...item,
      unit_price_snapshot: unitPrice === null || unitPrice === undefined ? null : Number(unitPrice),
      price_snapshot_at: now,
      updated_at: item.updated_at || now,
    } : item);
    persist(next, async rows => {
      const item = rows.find(x => x.product_id === id);
      if (item) await supabase.from('customer_cart_items').upsert(remoteShape(userId, item), { onConflict: 'user_id,product_id' });
    });
  }

  return { items, count, add, update, remove, clear, setGift, setPriceSnapshot, syncing, synced };
}
