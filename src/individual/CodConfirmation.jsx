import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, CircleAlert, LoaderCircle, ShieldCheck } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { formatSar } from '../lib/storePricing';
import './cod-confirmation.css';

const COPY = {
  INVALID_CONFIRMATION: ['رابط التأكيد غير صالح.', 'This confirmation link is invalid.'],
  CONFIRMATION_EXPIRED: ['انتهت صلاحية رابط التأكيد. اطلب من صاحب الطلب التواصل مع بلقيس.', 'This confirmation link has expired. Ask the customer to contact Balqees.'],
  PHONE_MISMATCH: ['آخر 4 أرقام لا تطابق رقم المسؤول عن السداد.', 'The last 4 digits do not match the payer phone number.'],
  TERMS_REQUIRED: ['وافق على مسؤولية السداد للمتابعة.', 'Accept payment responsibility to continue.'],
  CONFIRMATION_NOT_AVAILABLE: ['هذا التأكيد لم يعد متاحًا.', 'This confirmation is no longer available.'],
};
function messageFor(error, ar){
  const text=String(error?.message||error||'');
  const key=Object.keys(COPY).find(k=>text.includes(k));
  return key?COPY[key][ar?0:1]:(ar?'تعذر إكمال التأكيد الآن.':'We could not complete the confirmation right now.');
}
function orderNo(value){return `#${String(value||'').padStart(5,'0')}`;}

export default function CodConfirmation({ lang }){
  const ar=lang==='ar';
  const { token }=useParams();
  const [loading,setLoading]=useState(true);
  const [data,setData]=useState(null);
  const [last4,setLast4]=useState('');
  const [accepted,setAccepted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [done,setDone]=useState(false);

  useEffect(()=>{
    document.body.classList.add('individual-account-active');
    return()=>document.body.classList.remove('individual-account-active');
  },[]);
  useEffect(()=>{
    if(!token||!supabase){setLoading(false);return;}
    let live=true;
    supabase.rpc('get_cod_confirmation',{p_token:token}).then(({data:row,error:e})=>{
      if(!live)return;
      if(e||!row)setError(e?messageFor(e,ar):(ar?'رابط التأكيد غير صالح.':'This confirmation link is invalid.'));
      else{setData(row);if(row.status==='recipient_confirmed')setDone(true);}
      setLoading(false);
    });
    return()=>{live=false;};
  },[token,ar]);

  async function confirm(){
    if(!accepted){setError(COPY.TERMS_REQUIRED[ar?0:1]);return;}
    setBusy(true);setError('');
    const {data:result,error:e}=await supabase.rpc('confirm_cod_responsibility',{p_token:token,p_phone_last4:last4,p_accept:true});
    setBusy(false);
    if(e){setError(messageFor(e,ar));return;}
    if(result?.confirmed)setDone(true);
  }

  const expired=data?.expires_at&&new Date(data.expires_at).getTime()<Date.now();
  return <main className="cod-confirm-page" dir={ar?'rtl':'ltr'}>
    <section className="cod-confirm-card">
      <div className="cod-confirm-brand"><BrandMark/></div>
      {loading?<div className="cod-confirm-state"><LoaderCircle className="spin"/><p>{ar?'نتحقق من رابط الطلب…':'Checking the order link…'}</p></div>:
      done?<div className="cod-confirm-state success"><span><BadgeCheck/></span><small>{ar?'تم التأكيد':'CONFIRMED'}</small><h1>{ar?'تم تأكيد مسؤولية السداد':'Payment responsibility confirmed'}</h1><p>{ar?'أصبح بإمكان فريق بلقيس متابعة الطلب وفق حالة المراجعة والتجهيز.':'Balqees can now continue the order according to its review and preparation status.'}</p>{data?.order_number&&<strong>{orderNo(data.order_number)}</strong>}<Link to="/">{ar?'العودة إلى بلقيس':'Back to Balqees'}</Link></div>:
      error&&!data?<div className="cod-confirm-state error"><CircleAlert/><h1>{ar?'تعذر فتح التأكيد':'Confirmation unavailable'}</h1><p>{error}</p><Link to="/">{ar?'العودة إلى بلقيس':'Back to Balqees'}</Link></div>:
      <>
        <div className="cod-confirm-heading"><span><ShieldCheck/></span><small>{ar?'تأكيد الدفع عند الاستلام':'CASH ON DELIVERY CONFIRMATION'}</small><h1>{ar?'تأكيد مسؤولية السداد':'Confirm payment responsibility'}</h1><p>{ar?'هذا التأكيد لا يطلب أي بيانات بطاقة. المطلوب فقط تأكيد أنك تعرف قيمة الطلب وستسددها عند الاستلام قبل تسليم الطلب.':'No card details are requested. Confirm only that you know the order amount and will pay it on delivery before handover.'}</p></div>
        <div className="cod-confirm-summary"><div><small>{ar?'الطلب':'Order'}</small><strong>{orderNo(data?.order_number)}</strong></div><div><small>{ar?'الإجمالي':'Total'}</small><strong>{formatSar(data?.total||0,lang)}</strong></div><div><small>{ar?'المسؤول عن السداد':'Payer'}</small><strong>{data?.payer_name||'—'}</strong></div></div>
        {expired&&<div className="cod-confirm-warning"><CircleAlert/><span>{COPY.CONFIRMATION_EXPIRED[ar?0:1]}</span></div>}
        {!expired&&<div className="cod-confirm-form">
          <label><span>{ar?'آخر 4 أرقام من رقم الجوال':'Last 4 digits of phone number'}</span><input inputMode="numeric" maxLength={4} value={last4} onChange={e=>setLast4(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="••••"/></label>
          <label className="cod-confirm-check"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>{ar?`أؤكد أنني أعرف أن إجمالي الطلب ${formatSar(data?.total||0,lang)} وأنني المسؤول عن سداد المبلغ عند الاستلام قبل تسليم الطلب.`:`I confirm I know the order total is ${formatSar(data?.total||0,lang)} and I am responsible for paying it on delivery before handover.`}</span></label>
          {error&&<div className="cod-confirm-error"><CircleAlert/><span>{error}</span></div>}
          <button type="button" onClick={confirm} disabled={busy||last4.length!==4||!accepted}>{busy?<><LoaderCircle className="spin"/>{ar?'جارٍ التأكيد…':'Confirming…'}</>:<>{ar?'تأكيد المسؤولية':'Confirm responsibility'}<BadgeCheck/></>}</button>
          <small>{ar?'نسخة الشروط المعتمدة: ':'Terms version: '}{data?.terms_version||'—'}</small>
        </div>}
      </>}
    </section>
  </main>;
}
