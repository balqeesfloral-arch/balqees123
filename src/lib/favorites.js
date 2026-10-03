import { supabase } from './supabase';
import { recordCustomerInterest } from './customerPreferences';

export function favoriteSnapshot(product) {
  if (!product) return {};
  return {
    id: product.id,
    slug: product.slug || null,
    sku: product.sku || null,
    name_ar: product.name_ar || null,
    name_en: product.name_en || null,
    image_url: product.image_url || null,
    unit_ar: product.unit_ar || null,
    unit_en: product.unit_en || null,
    category_id: product.category_id || null,
    tags: Array.isArray(product.tags) ? product.tags.slice(0, 24) : [],
  };
}

async function recordInterest(userId, eventType, product) {
  if (!userId || !product?.id) return;
  await recordCustomerInterest({
    user_id: userId,
    event_type: eventType,
    product_id: product.id,
    category_id: product.category_id || null,
    metadata: { source: 'favorites' },
  });
}

export async function saveFavorite({ userId, product, unitPrice = null, collectionName = null, note = null }) {
  if (!supabase || !userId || !product?.id) return { error: new Error('FAVORITE_REQUIRES_ACCOUNT') };
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    product_id: product.id,
    collection_name: collectionName?.trim() || null,
    note: note?.trim() || null,
    product_snapshot: favoriteSnapshot(product),
    unit_price_snapshot: unitPrice === null || unitPrice === undefined ? null : Number(unitPrice),
    price_snapshot_at: unitPrice === null || unitPrice === undefined ? null : now,
    updated_at: now,
  };
  const result = await supabase.from('customer_favorites').upsert(payload, { onConflict: 'user_id,product_id' });
  if (!result.error) recordInterest(userId, 'favorite', product);
  return result;
}

export async function removeFavorite({ userId, product }) {
  if (!supabase || !userId || !product?.id) return { error: new Error('FAVORITE_REQUIRES_ACCOUNT') };
  const result = await supabase.from('customer_favorites').delete().eq('user_id', userId).eq('product_id', product.id);
  if (!result.error) recordInterest(userId, 'unfavorite', product);
  return result;
}

export async function updateFavoriteMeta({ userId, productId, collectionName = null, note = null }) {
  if (!supabase || !userId || !productId) return { error: new Error('FAVORITE_REQUIRES_ACCOUNT') };
  return supabase.from('customer_favorites').update({
    collection_name: collectionName?.trim() || null,
    note: note?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('product_id', productId);
}
