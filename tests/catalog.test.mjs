import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProduct, matchesCatalogFilter } from '../src/admin/catalogValidation.js';
import { resolveProductPrice } from '../src/lib/storePricing.js';
const product = { name_ar: 'ورد', name_en: 'Flowers', base_price: '220', sale_price: '', price_on_request: false, stock_quantity: 0, min_order_quantity: 1, max_order_quantity: '', cost_price: '', target_margin_percent: 35, low_stock_threshold: 3 };
test('valid made-to-order product and request-only product can be saved', () => {
  assert.equal(validateProduct(product), null);
  assert.equal(validateProduct({ ...product, price_on_request: true, base_price: '' }), null);
});
test('bad prices and quantity limits are rejected before publication', () => {
  for (const price of ['', '-1', 'bad', Infinity]) assert.equal(validateProduct({ ...product, base_price: price }), 'price');
  assert.equal(validateProduct({ ...product, sale_price: '221' }), 'sale');
  assert.equal(validateProduct({ ...product, stock_quantity: -1 }), 'stock');
  assert.equal(validateProduct({ ...product, min_order_quantity: 5, max_order_quantity: 4 }), 'quantity');
});
test('zero sale price stays a sale and private cost does not affect public pricing', () => {
  const sale = { ...product, sale_price: 0, cost_price: 150 };
  assert.equal(validateProduct(sale), null);
  assert.equal(resolveProductPrice(sale, []).effective, 0);
});
test('margins and chronological sale dates are validated', () => {
  assert.equal(validateProduct({ ...product, target_margin_percent: 100 }), 'margin');
  assert.equal(validateProduct({ ...product, low_stock_threshold: -1 }), 'threshold');
  assert.equal(validateProduct({ ...product, sale_starts_at: '2026-10-05', sale_ends_at: '2026-10-04' }), 'dates');
});
test('dashboard filters distinguish unpublished products, empty stock and missing photos', () => {
  const published = { is_active: true, visibility: 'public', stock_mode: 'tracked', stock_quantity: 0, image_url: null };
  assert.equal(matchesCatalogFilter(published, 'published'), true);
  assert.equal(matchesCatalogFilter(published, 'out-of-stock'), true);
  assert.equal(matchesCatalogFilter(published, 'missing-images'), true);
  assert.equal(matchesCatalogFilter({ ...published, visibility: 'draft' }, 'published'), false);
  assert.equal(matchesCatalogFilter({ ...published, stock_mode: 'made_to_order' }, 'out-of-stock'), false);
  assert.equal(matchesCatalogFilter({ ...published, visibility: 'draft' }, 'missing-images'), false);
});
