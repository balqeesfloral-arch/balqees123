export const QUOTE_SERVICES = [
  ['weekly_flowers','عقد الورد الأسبوعي','Weekly flower contract'],
  ['monthly_flowers','عقد الورد الشهري','Monthly flower contract'],
  ['maintenance','صيانة النباتات والحدائق','Plant & garden maintenance'],
  ['hospitality','تنسيق الفنادق والضيافة','Hospitality styling'],
  ['floral','تنسيق الورد الطبيعي','Floral styling'],
  ['bouquets','الباقات والهدايا','Bouquets & gifts'],
  ['indoor','النباتات الداخلية','Indoor plants'],
  ['landscape','الشجر والتشجير','Trees & landscaping'],
  ['planters','المراكن والفازات','Planters & vases'],
  ['seasonal','المواسم والمناسبات','Seasons & events'],
  ['custom','خدمة مخصصة','Custom service'],
];
export const QUOTE_STATUSES = [
  ['submitted','تم إرسال الطلب','Submitted'],['in_review','قيد المراجعة','Under review'],
  ['needs_info','نحتاج تفاصيل إضافية','More information needed'],['quoted','صدر عرض السعر','Quotation issued'],['closed','مغلق','Closed'],
];
export const quoteServiceLabel = (key,ar=true) => QUOTE_SERVICES.find(row=>row[0]===key)?.[ar?1:2] || (ar?'طلب منتجات':'Product request');
export const quoteStatusLabel = (key,ar=true) => QUOTE_STATUSES.find(row=>row[0]===key)?.[ar?1:2] || key;
export function quoteRequestPath({service,product,quantity=1,source}={}) {
  const query = new URLSearchParams();
  if(service) query.set('service',service==='care'?'maintenance':service);
  if(product) {query.set('product',product);query.set('quantity',String(quantity));}
  if(source) query.set('source',source);
  return `/request-quote${query.size?`?${query}`:''}`;
}
export function safeQuoteReturn(value) {
  if(!value || !/^\/request-quote(?:\?[^#\r\n]*)?$/.test(value)) return null;
  return value;
}
export function adminQuoteRequestPath(id) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id||''))) return null;
  return `/admin/quote-requests?request=${String(id).toLowerCase()}`;
}
export function safeAdminQuoteReturn(value) {
  if(typeof value!=='string'||!value.startsWith('/admin/quote-requests?')||/[#\r\n\\]/.test(value)) return null;
  const params=new URLSearchParams(value.slice(value.indexOf('?')+1));
  if([...params.keys()].length!==1||!params.has('request')) return null;
  return adminQuoteRequestPath(params.get('request'));
}
export function validateQuoteForm(form,ar=true) {
  if(String(form.contact_name||'').trim().length<2) return ar?'أدخل اسم جهة التواصل.':'Enter a contact name.';
  if(!/^\+?[0-9 ()-]{8,24}$/.test(String(form.phone||'').trim())) return ar?'أدخل رقم جوال صحيحًا.':'Enter a valid phone number.';
  if(form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return ar?'تحقق من البريد الإلكتروني.':'Check the email address.';
  if(String(form.location||'').trim().length<2) return ar?'حدد المدينة والموقع.':'Enter the city and location.';
  if(String(form.description||'').trim().length<10) return ar?'اكتب تفاصيل الاحتياج في ١٠ أحرف على الأقل.':'Describe your needs in at least 10 characters.';
  return '';
}
const ERRORS = {
  PRODUCT_UNAVAILABLE:['أحد المنتجات غير متاح الآن. حدّث السلة.','A product is unavailable. Refresh your cart.'],
  INSUFFICIENT_STOCK:['الكمية المطلوبة تتجاوز المخزون.','Requested quantity exceeds stock.'],
  MIN_QUANTITY:['الكمية أقل من الحد الأدنى للمنتج.','Quantity is below the product minimum.'],
  MAX_QUANTITY:['الكمية تتجاوز الحد الأعلى للمنتج.','Quantity exceeds the product maximum.'],
  STORE_DISABLED:['المتجر متوقف مؤقتًا. يمكنك طلب الخدمات.','The store is temporarily closed. Service requests remain available.'],
  REQUEST_CHANGED:['تم تحديث الطلب. أعد تحميله قبل حفظ ردك.','The request changed. Refresh before saving your reply.'],
  REQUEST_CLOSED:['هذا الطلب مغلق.','This request is closed.'],
  AUTH_REQUIRED:['سجّل الدخول لإرسال الطلب.','Sign in to submit the request.'],
  QUOTE_AMOUNT_REQUIRED:['أدخل إجمالي عرض سعر أكبر من صفر.','Enter a quotation total greater than zero.'],
  QUOTE_EXPIRED:['اختر تاريخ صلاحية يبدأ من اليوم.','Choose a validity date from today onwards.'],
  REPLY_REQUIRED:['اكتب ردًا واضحًا للعميل.','Write a reply to the customer.'],
  INVALID_DATE:['الموعد المفضل يجب أن يبدأ من اليوم.','The preferred date must be today or later.'],
};
export function quoteError(error,ar=true) {
  const key=Object.keys(ERRORS).find(k=>String(error?.message||'').includes(k));
  return key?ERRORS[key][ar?0:1]:(ar?'تعذر حفظ الطلب الآن. حاول مرة أخرى.':'Could not save the request. Please try again.');
}
