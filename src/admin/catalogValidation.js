export function validateProduct(form) {
  if (!String(form.name_ar || '').trim() || !String(form.name_en || '').trim()) return 'names';
  const number = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
  if (!form.price_on_request && (!number(form.base_price) || Number(form.base_price) <= 0)) return 'price';
  if (!form.price_on_request && form.sale_price !== '' && form.sale_price !== null && form.sale_price !== undefined && (!number(form.sale_price) || Number(form.sale_price) < 0 || Number(form.sale_price) > Number(form.base_price))) return 'sale';
  if (!number(form.stock_quantity) || Number(form.stock_quantity) < 0) return 'stock';
  if (!number(form.min_order_quantity) || Number(form.min_order_quantity) <= 0 || (form.max_order_quantity !== '' && form.max_order_quantity !== null && form.max_order_quantity !== undefined && (!number(form.max_order_quantity) || Number(form.max_order_quantity) < Number(form.min_order_quantity)))) return 'quantity';
  if (form.cost_price !== '' && (!number(form.cost_price) || Number(form.cost_price) < 0)) return 'cost';
  if (form.target_margin_percent !== '' && (!number(form.target_margin_percent) || Number(form.target_margin_percent) < 0 || Number(form.target_margin_percent) >= 100)) return 'margin';
  if (!number(form.low_stock_threshold) || Number(form.low_stock_threshold) < 0) return 'threshold';
  if (form.sale_starts_at && form.sale_ends_at && new Date(form.sale_ends_at) <= new Date(form.sale_starts_at)) return 'dates';
  return null;
}

export const PRODUCT_VALIDATION_MESSAGES = {
  names: ['اسم المنتج بالعربية والإنجليزية مطلوب.', 'Arabic and English names are required.'],
  price: ['أدخل سعر بيع صحيحًا أكبر من صفر.', 'Enter a valid selling price above zero.'],
  sale: ['سعر العرض يجب أن يكون بين صفر وسعر البيع الأساسي.', 'Sale price must be between zero and the regular price.'],
  stock: ['المخزون يجب أن يكون رقمًا غير سالب.', 'Stock must be a non-negative number.'],
  quantity: ['تحقق من الحد الأدنى والأقصى للطلب؛ الحد الأقصى يجب ألا يقل عن الأدنى.', 'Check order limits; the maximum must be at least the minimum.'],
  cost: ['التكلفة يجب أن تكون رقمًا غير سالب.', 'Cost must be a non-negative number.'],
  margin: ['الهامش المستهدف يجب أن يكون من صفر إلى أقل من 100%.', 'Target margin must be between zero and less than 100%.'],
  threshold: ['حد تنبيه المخزون يجب أن يكون رقمًا غير سالب.', 'Low-stock threshold must be non-negative.'],
  dates: ['نهاية العرض يجب أن تكون بعد بدايته.', 'Sale end must be after its start.'],
};

export function catalogError(error, ar) {
  if (error?.code === '23505') return ar ? 'رمز المنتج أو رابط المنتج مستخدم بالفعل. اختر قيمة مختلفة.' : 'The SKU or product link is already in use. Choose a different value.';
  if (error?.code === '23503') return ar ? 'تعذر حذف هذا السجل لأنه مرتبط بسجلات أخرى.' : 'This record cannot be deleted because other records reference it.';
  if (error?.code === '42501') return ar ? 'الجلسة لا تملك صلاحية هذا التعديل. سجّل الدخول بحساب مدير فعّال.' : 'This session cannot make this change. Sign in as an active administrator.';
  return ar ? 'تعذر إكمال العملية. تحقق من البيانات والاتصال ثم حاول مجددًا.' : 'The operation failed. Check the data and connection, then retry.';
}

export function matchesCatalogFilter(product, filter) {
  if (filter === 'published') return product.is_active && product.visibility === 'public';
  if (filter === 'draft') return product.visibility === 'draft';
  if (filter === 'out-of-stock') return product.stock_mode === 'tracked' && Number(product.stock_quantity) <= 0 && product.is_active;
  if (filter === 'missing-images') return !product.image_url && product.is_active && product.visibility === 'public';
  return true;
}
