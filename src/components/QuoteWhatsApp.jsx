import { MessageCircle } from 'lucide-react';
import { quoteWhatsAppHref } from '../lib/quoteWhatsApp';

export default function QuoteWhatsApp({request,lang,compact=false}) {
  const ar=lang==='ar';
  const siteUrl=import.meta.env.VITE_PUBLIC_SITE_URL||window.location.origin;
  const href=quoteWhatsAppHref(request,{ar,siteUrl});
  if(!href||request.status==='closed') return null;
  return <div className={`rfq-whatsapp ${compact?'compact':''}`}>
    <a className="btn rfq-whatsapp-button" href={href} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/>{ar?'إرسال للمبيعات عبر واتساب':'Send to sales via WhatsApp'}</a>
    <small>{ar?'تفتح رسالة جاهزة بتفاصيل طلبك. اضغط «إرسال» داخل واتساب؛ ثم تابع عرض السعر في حسابك.':'A draft opens with your request details. Press Send in WhatsApp, then track the quotation in your account.'}</small>
  </div>;
}
