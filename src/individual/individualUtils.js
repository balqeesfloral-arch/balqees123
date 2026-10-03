export const ORDER_FLOW = ['pending', 'under_review', 'quoted', 'approved', 'in_progress', 'ready', 'out_for_delivery', 'delivered', 'completed'];
export const ACTIVE_ORDER_STATUSES = new Set(['pending', 'under_review', 'quoted', 'approved', 'in_progress', 'ready', 'out_for_delivery', 'delivered', 'delivery_failed_payment']);
export const COMPLETED_ORDER_STATUSES = new Set(['completed']);
export const EDITABLE_ORDER_STATUSES = new Set(['pending', 'under_review', 'quoted', 'approved']);

export const ORDER_STATUS = {
  ar: {
    pending: { title: 'تم استلام الطلب', desc: 'وصل طلبك إلى بلقيس بنجاح، وسنراجع التفاصيل قبل بدء التنفيذ.', next: 'مراجعة الطلب', tone: 'neutral' },
    under_review: { title: 'قيد المراجعة', desc: 'فريق بلقيس يراجع المنتجات والعنوان وبيانات الطلب.', next: 'اعتماد التفاصيل', tone: 'gold' },
    quoted: { title: 'تمت مراجعة التسعير', desc: 'تم تثبيت التسعير المسجل للطلب وأصبح جاهزًا للمرحلة التالية.', next: 'اعتماد الطلب', tone: 'gold' },
    approved: { title: 'تم اعتماد الطلب', desc: 'اعتمدت تفاصيل الطلب وأصبح جاهزًا لبدء التجهيز.', next: 'بدء التجهيز', tone: 'good' },
    in_progress: { title: 'قيد التجهيز', desc: 'نجهز طلبك الآن بعناية حسب التفاصيل المسجلة.', next: 'جاهز للتسليم', tone: 'good' },
    ready: { title: 'جاهز للتسليم', desc: 'اكتمل تجهيز طلبك وأصبح جاهزًا للتسليم.', next: 'الخروج للتوصيل', tone: 'good' },
    out_for_delivery: { title: 'في الطريق', desc: 'طلبك خرج للتوصيل وهو في طريقه إلى العنوان المسجل.', next: 'التسليم والتحصيل', tone: 'good' },
    delivered: { title: 'تم التسليم', desc: 'تم تسجيل تسليم الطلب ونكمل الآن إغلاقه وتأكيد حالته.', next: 'إكمال الطلب', tone: 'good' },
    delivery_failed_payment: { title: 'تعذر إكمال التسليم', desc: 'يوجد تعثر في التسليم أو التحصيل ويحتاج متابعة مع فريق بلقيس.', next: 'حل المشكلة', tone: 'danger' },
    completed: { title: 'مكتمل', desc: 'اكتملت رحلة هذا الطلب بنجاح.', next: 'يمكنك إعادة الطلب', tone: 'complete' },
    cancelled: { title: 'ملغي', desc: 'تم إلغاء هذا الطلب ولا توجد عليه مراحل تنفيذ إضافية.', next: 'يمكنك بدء طلب جديد', tone: 'muted' },
  },
  en: {
    pending: { title: 'Order received', desc: 'Your order reached Balqees successfully and is waiting for review.', next: 'Order review', tone: 'neutral' },
    under_review: { title: 'Under review', desc: 'Balqees is reviewing the products, address and order details.', next: 'Approve details', tone: 'gold' },
    quoted: { title: 'Pricing reviewed', desc: 'The recorded pricing is ready for the next stage.', next: 'Approve order', tone: 'gold' },
    approved: { title: 'Order approved', desc: 'Your order details are approved and ready for preparation.', next: 'Start preparation', tone: 'good' },
    in_progress: { title: 'Preparing', desc: 'We are preparing your order with care.', next: 'Ready for delivery', tone: 'good' },
    ready: { title: 'Ready for delivery', desc: 'Preparation is complete and the order is ready for handoff.', next: 'Out for delivery', tone: 'good' },
    out_for_delivery: { title: 'On the way', desc: 'Your order is on the way to the saved address.', next: 'Delivery and collection', tone: 'good' },
    delivered: { title: 'Delivered', desc: 'Delivery has been recorded and the order is being finalized.', next: 'Complete order', tone: 'good' },
    delivery_failed_payment: { title: 'Delivery could not be completed', desc: 'A delivery or collection issue was recorded and needs Balqees support.', next: 'Resolve issue', tone: 'danger' },
    completed: { title: 'Completed', desc: 'This order journey has been completed successfully.', next: 'You can order it again', tone: 'complete' },
    cancelled: { title: 'Cancelled', desc: 'This order was cancelled and has no further fulfillment stages.', next: 'Start a new order', tone: 'muted' },
  },
};

export const HOME_MILESTONES = [
  { key: 'received', statuses: ['pending'] },
  { key: 'review', statuses: ['under_review', 'quoted'] },
  { key: 'approved', statuses: ['approved'] },
  { key: 'preparing', statuses: ['in_progress'] },
  { key: 'delivery', statuses: ['ready', 'out_for_delivery', 'delivered', 'delivery_failed_payment'] },
  { key: 'completed', statuses: ['completed'] },
];

export function statusMeta(order, lang) {
  return ORDER_STATUS[lang]?.[order?.status] || { title: order?.status || '—', desc: lang === 'ar' ? 'آخر حالة مسجلة لهذا الطلب.' : 'Latest recorded order status.', next: '—', tone: 'neutral' };
}

export function fmtDate(value, lang, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-GB', withTime ? {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh',
  } : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(date);
}

export function fmtRelative(value, lang) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return lang === 'ar' ? 'الآن' : 'just now';
  if (minutes < 60) return lang === 'ar' ? `قبل ${minutes} د` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === 'ar' ? `قبل ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return lang === 'ar' ? `قبل ${days} يوم` : `${days}d ago`;
  return fmtDate(value, lang, false);
}

export function orderNo(order) {
  return `#${String(order?.order_number || order?.id || '').padStart(5, '0')}`;
}

export function productName(snapshot, ar) {
  return ar ? (snapshot?.name_ar || snapshot?.name_en || 'منتج بلقيس') : (snapshot?.name_en || snapshot?.name_ar || 'Balqees product');
}

export function addressText(address, ar, compact = false) {
  if (!address || typeof address !== 'object') return '';
  if (!compact && address.formatted_address) return address.formatted_address;
  const parts = compact
    ? [address.label, address.district, address.city]
    : [address.label, address.district, address.city, address.street, address.building_number];
  const clean = parts.filter(Boolean);
  return clean.length ? clean.join(ar ? '، ' : ', ') : '';
}

export function recipientName(order, ar) {
  const recipient = order?.recipient_snapshot;
  if (!recipient || typeof recipient !== 'object') return ar ? 'المستلم المسجل في الطلب' : 'Order recipient';
  return recipient.full_name || recipient.name || recipient.label || (ar ? 'المستلم المسجل في الطلب' : 'Order recipient');
}

export function orderAddress(order) {
  if (order?.address_snapshot && Object.keys(order.address_snapshot).length) return order.address_snapshot;
  return order?.service_address || {};
}

export function isAddressComplete(address) {
  if (!address || typeof address !== 'object') return false;
  return Boolean(address.formatted_address || (address.city && (address.district || address.street)));
}

export function requiresAction(order) {
  if (!order) return false;
  if (order.status === 'delivery_failed_payment') return true;
  if (order.cod_confirmation_status === 'recipient_confirmation_required') return true;
  if (order.cod_review_status === 'pending') return true;
  if (EDITABLE_ORDER_STATUSES.has(order.status) && !isAddressComplete(orderAddress(order))) return true;
  return false;
}

export function actionReason(order, lang) {
  const ar = lang === 'ar';
  if (!order) return null;
  if (order.status === 'delivery_failed_payment') return { title: ar ? 'تعذر إكمال التسليم أو التحصيل' : 'Delivery or collection could not be completed', body: ar ? 'نحتاج متابعة هذه الحالة قبل إكمال الطلب.' : 'This needs follow-up before the order can be completed.', action: 'support' };
  if (order.cod_confirmation_status === 'recipient_confirmation_required') return { title: ar ? 'نحتاج تأكيد المسؤول عن السداد' : 'Payer confirmation is required', body: ar ? 'الدفع عند الاستلام يحتاج تأكيد الشخص المسؤول عن السداد.' : 'Cash on delivery requires confirmation from the person responsible for payment.', action: 'support' };
  if (order.cod_review_status === 'pending') return { title: ar ? 'طلبك قيد مراجعة إضافية' : 'Your order is under additional review', body: ar ? 'فريق بلقيس يراجع الطلب قبل بدء التنفيذ.' : 'Balqees is reviewing the order before fulfillment starts.', action: 'details' };
  if (EDITABLE_ORDER_STATUSES.has(order.status) && !isAddressComplete(orderAddress(order))) return { title: ar ? 'عنوان التسليم يحتاج إكمالًا' : 'Delivery address needs completion', body: ar ? 'أكمل عنوان الطلب قبل بدء التجهيز.' : 'Complete the delivery address before preparation starts.', action: 'address' };
  return null;
}

export function orderSearchText(order) {
  const items = (order?.order_items || []).map(item => `${item.product_snapshot?.name_ar || ''} ${item.product_snapshot?.name_en || ''} ${item.product_snapshot?.sku || ''}`).join(' ');
  const recipient = order?.recipient_snapshot || {};
  const address = orderAddress(order);
  return [
    order?.order_number,
    order?.status,
    order?.customer_label,
    items,
    recipient.full_name,
    recipient.label,
    recipient.phone,
    address.label,
    address.district,
    address.city,
    address.street,
    order?.gift_message,
    order?.customer_note,
  ].filter(Boolean).join(' ').toLowerCase();
}

export function currentMilestoneIndex(status) {
  const index = HOME_MILESTONES.findIndex(step => step.statuses.includes(status));
  return index < 0 ? 0 : index;
}

export function occasionLabel(occasion, lang) {
  const ar = lang === 'ar';
  const labels = {
    ramadan: [ 'رمضان', 'Ramadan' ],
    eid_fitr: [ 'عيد الفطر', 'Eid al-Fitr' ],
    eid_adha: [ 'عيد الأضحى', 'Eid al-Adha' ],
    hajj: [ 'الحج', 'Hajj' ],
    wedding: [ 'زواج', 'Wedding' ],
    malka: [ 'مَلْكة', 'Malka' ],
    engagement: [ 'خطبة', 'Engagement' ],
    return_from_travel: [ 'قدوم من سفر', 'Return from travel' ],
    usual_gift: [ 'هدية معتادة', 'Usual gift' ],
    new_baby: [ 'مولود جديد', 'New baby' ],
    graduation: [ 'تخرج', 'Graduation' ],
    party: [ 'حفلة', 'Party' ],
  };
  const grad = {
    secondary: [ 'ثانوي', 'Secondary school' ],
    bachelor: [ 'بكالوريوس', 'Bachelor' ],
    master: [ 'ماجستير', 'Master' ],
    doctorate: [ 'دكتوراه', 'Doctorate' ],
  };
  const base = labels[occasion?.occasion_type]?.[ar ? 0 : 1] || occasion?.occasion_type || (ar ? 'مناسبة' : 'Occasion');
  if (occasion?.occasion_type === 'graduation' && occasion?.graduation_level) {
    return `${base} · ${grad[occasion.graduation_level]?.[ar ? 0 : 1] || occasion.graduation_level}`;
  }
  return base;
}

export function historyBucket(value, lang) {
  const ar = lang === 'ar';
  const date = new Date(value);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.floor((startToday - startDate) / 86400000);
  if (days <= 0) return { key: 'today', label: ar ? 'اليوم' : 'Today' };
  if (days <= 7) return { key: 'week', label: ar ? 'هذا الأسبوع' : 'This week' };
  if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) return { key: 'month', label: ar ? 'هذا الشهر' : 'This month' };
  return { key: 'older', label: ar ? 'أقدم' : 'Older' };
}
