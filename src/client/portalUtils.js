import { supabase } from '../lib/supabase';

export const orderLabels = {
  ar: { pending: 'جديد', under_review: 'قيد المراجعة', quoted: 'تم التسعير', approved: 'معتمد', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي' },
  en: { pending: 'Pending', under_review: 'Under review', quoted: 'Quoted', approved: 'Approved', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' },
};

export const quoteLabels = {
  ar: { draft: 'مسودة', sent: 'بانتظار قرارك', viewed: 'تمت المراجعة', accepted: 'معتمد', declined: 'مرفوض', revision_requested: 'طلب تعديل', expired: 'منتهي', cancelled: 'ملغي' },
  en: { draft: 'Draft', sent: 'Awaiting your decision', viewed: 'Reviewed', accepted: 'Accepted', declined: 'Declined', revision_requested: 'Revision requested', expired: 'Expired', cancelled: 'Cancelled' },
};

export const contractLabels = {
  ar: { draft: 'مسودة', active: 'ساري', expiring: 'قريب الانتهاء', expired: 'منتهي', terminated: 'منهي', cancelled: 'ملغي' },
  en: { draft: 'Draft', active: 'Active', expiring: 'Expiring soon', expired: 'Expired', terminated: 'Terminated', cancelled: 'Cancelled' },
};

export const paymentLabels = {
  ar: { not_applicable: 'غير مطبق', unpaid: 'غير مدفوع', partially_paid: 'مدفوع جزئيًا', paid: 'مدفوع', overdue: 'متأخر' },
  en: { not_applicable: 'N/A', unpaid: 'Unpaid', partially_paid: 'Partially paid', paid: 'Paid', overdue: 'Overdue' },
};

function portalFormatPrefs() {
  if (typeof document === 'undefined') return { dateSystem:'gregorian', timeFormat:'24h', timezone:'Asia/Riyadh', numberingSystem:'latn' };
  const node=document.querySelector('.client-app');
  return {
    dateSystem:node?.dataset?.portalDateSystem || 'gregorian',
    timeFormat:node?.dataset?.portalTimeFormat || '24h',
    timezone:node?.dataset?.portalTimezone || 'Asia/Riyadh',
    numberingSystem:node?.dataset?.portalNumber === 'arabic_indic' ? 'arab' : 'latn',
  };
}

function formatOneDate(d,lang,withTime,calendar,prefs){
  const localeBase=lang==='ar'?'ar-SA':'en-GB';
  const locale=`${localeBase}-u-ca-${calendar}-nu-${prefs.numberingSystem}`;
  return new Intl.DateTimeFormat(locale,withTime?{
    dateStyle:'medium',timeStyle:'short',hour12:prefs.timeFormat==='12h',timeZone:prefs.timezone,
  }:{dateStyle:'medium',timeZone:prefs.timezone}).format(d);
}

export function fmtDate(value, lang='ar', withTime=false) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const prefs=portalFormatPrefs();
  if(prefs.dateSystem==='hijri') return formatOneDate(d,lang,withTime,'islamic-umalqura',prefs);
  if(prefs.dateSystem==='dual'){
    const g=formatOneDate(d,lang,withTime,'gregory',prefs);
    const h=formatOneDate(d,lang,false,'islamic-umalqura',prefs);
    return `${g} · ${h}`;
  }
  return formatOneDate(d,lang,withTime,'gregory',prefs);
}

export function sar(value, lang='ar') {
  const prefs=portalFormatPrefs();
  return new Intl.NumberFormat(`${lang==='ar'?'ar-SA':'en-SA'}-u-nu-${prefs.numberingSystem}`, {
    style: 'currency', currency: 'SAR', maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function daysUntil(value) {
  if (!value) return null;
  const end = new Date(`${value}T23:59:59`);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86400000);
}

export function normalizeSaudiPhone(value='') {
  const digits = String(value).replace(/\D/g,'');
  if (!digits) return '';
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('0')) return `966${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('5')) return `966${digits}`;
  return digits;
}

export async function openPrivateDocument(path) {
  if (!path || !supabase) return false;
  const { data, error } = await supabase.storage.from('client-documents').createSignedUrl(path, 90);
  if (error || !data?.signedUrl) return false;
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  return true;
}

export function safeUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function statusTone(status='') {
  if (['accepted','active','completed','paid','approved'].includes(status)) return 'good';
  if (['declined','cancelled','terminated','expired','overdue'].includes(status)) return 'danger';
  if (['sent','viewed','revision_requested','expiring','pending','under_review','partially_paid'].includes(status)) return 'warn';
  return 'neutral';
}
