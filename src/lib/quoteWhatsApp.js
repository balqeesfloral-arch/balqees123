import { business } from './content.js';
import { adminQuoteRequestPath, quoteServiceLabel } from './quoteRequests.js';

const line = (value,limit=160) => {
  const text=String(value??'').replace(/\s+/g,' ').trim();
  return text.length>limit?`${text.slice(0,limit-1)}…`:text;
};

export function quoteSalesReviewUrl(request,siteUrl) {
  const path=adminQuoteRequestPath(request?.id);
  if(!path) return '';
  try {
    const base=new URL(siteUrl);
    if(!['https:','http:'].includes(base.protocol)||base.username||base.password) return '';
    return new URL(path,base.origin).href;
  } catch { return ''; }
}

// Only saved requests are shared. Product names and quantities come from the
// server's catalog snapshot, rather than the mutable cart or the submitted form.
export function quoteWhatsAppMessage(request,{ar=true,siteUrl}={}) {
  const reviewUrl=quoteSalesReviewUrl(request,siteUrl);
  if(!reviewUrl||!/^\d+$/.test(String(request?.request_number))||Number(request.request_number)<=0) return '';
  const lines=[ar?'مرحبًا مبيعات بلقيس، أرغب في عرض سعر للطلب التالي:':'Hello Balqees sales, I would like a quotation for this request:',`RFQ #${request.request_number}`];
  lines.push(`${ar?'الطلب':'Request'}: ${quoteServiceLabel(request.service_type,ar)}`);
  lines.push(`${ar?'العميل':'Contact'}: ${line(request.contact_name)}`);
  lines.push(`${ar?'الجوال':'Phone'}: ${line(request.phone,24)}`);
  lines.push(`${ar?'الموقع':'Location'}: ${line(request.location,200)}`);
  if(request.kind==='products'&&request.product_snapshot?.length) {
    lines.push('',ar?'المنتجات والكميات:':'Products & quantities:');
    for(const [index,item] of request.product_snapshot.entries()) {
      const name=line(ar?item.name_ar:item.name_en||item.name_ar,80);
      const unit=line(ar?item.unit_ar:item.unit_en||item.unit_ar,24);
      const sku=item.sku?` [${line(item.sku,32)}]`:'';
      lines.push(`${index+1}. ${name}${sku} — ${item.quantity}${unit?` ${unit}`:''}`);
    }
  } else {
    const schedules=ar?{weekly:'أسبوعي',monthly:'شهري',once:'مرة واحدة',custom:'حسب الاتفاق'}:{weekly:'Weekly',monthly:'Monthly',once:'One time',custom:'Custom schedule'};
    if(schedules[request.frequency]) lines.push(`${ar?'الجدول':'Schedule'}: ${schedules[request.frequency]}`);
    if(request.duration_months) lines.push(`${ar?'المدة':'Duration'}: ${request.duration_months} ${ar?'شهر':'months'}`);
  }
  if(request.preferred_date) lines.push(`${ar?'الموعد المفضل':'Preferred date'}: ${request.preferred_date}`);
  if(request.description) lines.push('',`${ar?'التفاصيل':'Details'}: ${line(request.description,500)}`);
  lines.push('',ar?'للمبيعات: التفاصيل الكاملة وتسجيل عرض السعر (يلزم حساب إدارة بلقيس):':'For sales: full request & quotation entry (Balqees admin sign-in required):',reviewUrl);
  return lines.join('\n');
}

// Click-to-chat prepares a draft; the customer presses Send in WhatsApp.
// Opening this URL never marks a request as delivered or changes its status.
export function quoteWhatsAppHref(request,options) {
  const message=quoteWhatsAppMessage(request,options);
  const phone=String(business.whatsapp).replace(/\D/g,'');
  if(!message||!/^05\d{8}$/.test(phone)) return '';
  return `https://wa.me/966${phone.slice(1)}?text=${encodeURIComponent(message)}`;
}
