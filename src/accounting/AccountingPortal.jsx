import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, FileText, RefreshCw, Send, ShieldCheck, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { accountingMoney as money, accountingDate as date, PAYMENT_STATES } from './statementDocument';
import { requestFingerprint, requestIdentity } from './requestIdentity';
import StatementPreview from './StatementPreview';
import './accounting.css';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const blank=()=>({amount:'',date:today(),method:'bank_transfer',reference:'',note:''});
const EXT={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
export default function AccountingPortal({lang='ar',organizationId=null,userId=null}) {
  const ar=lang==='ar',t=(a,e)=>ar?a:e;
  const [link,setLink]=useState(null),[latest,setLatest]=useState(null),[history,setHistory]=useState([]),[docs,setDocs]=useState([]),[payments,setPayments]=useState([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(null),[form,setForm]=useState(blank);
  const fileInput=useRef(null),working=useRef(false),sequence=useRef(0);
  const load=useCallback(async()=>{
    if(!supabase)return;
    const seq=++sequence.current;setLoading(true);
    try{
      let query=supabase.from('accounting_links').select('*').eq('is_active',true);
      if(organizationId)query=query.eq('organization_id',organizationId);
      else if(userId)query=query.eq('user_id',userId);
      else {setLink(null);return;}
      const {data:account,error:e}=await query.maybeSingle();if(e)throw e;
      if(seq!==sequence.current)return;
      setLink(account);if(!account){setPreview(null);setLatest(null);setHistory([]);setDocs([]);setPayments([]);setError('');return;}
      const results=await Promise.all([
        supabase.from('accounting_statements').select('*').eq('link_id',account.id).order('created_at',{ascending:false}).limit(1),
        supabase.from('accounting_statements').select('id,statement_number,created_at').eq('link_id',account.id).order('created_at',{ascending:false}).limit(30),
        supabase.from('accounting_documents').select('*').eq('link_id',account.id).order('created_at',{ascending:false}).limit(50),
        supabase.from('accounting_payments').select('*').eq('link_id',account.id).order('created_at',{ascending:false}).limit(50),
      ]);
      if(results.some(r=>r.error))throw new Error('LOAD_FAILED');
      if(seq!==sequence.current)return;
      setLatest(results[0].data[0]||null);setHistory(results[1].data);setDocs(results[2].data);setPayments(results[3].data);setError('');
    }catch{if(seq===sequence.current)setError(ar?'تعذر تحميل بيانات المكتب. أعد المحاولة.':'Could not load accounting data. Please retry.');}
    finally{if(seq===sequence.current)setLoading(false);}
  },[organizationId,userId,ar]);
  useEffect(()=>{load();return()=>{sequence.current++;};},[load]);
  useEffect(()=>{
    if(!supabase)return;
    const channel=supabase.channel(`accounting-portal:${organizationId||userId}`);
    if(organizationId||userId)channel.on('postgres_changes',{event:'*',schema:'public',table:'accounting_links',filter:`${organizationId?'organization_id':'user_id'}=eq.${organizationId||userId}`},load);
    if(link)for(const table of ['accounting_statements','accounting_documents','accounting_payments'])channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`link_id=eq.${link.id}`},load);
    channel.subscribe();
    const focus=()=>{if(!working.current)load();};window.addEventListener('focus',focus);
    return()=>{supabase.removeChannel(channel);window.removeEventListener('focus',focus);};
  },[link?.id,organizationId,userId,load]);
  const patch=(key,value)=>setForm(f=>({...f,[key]:value}));
  async function submit(event) {
    event.preventDefault();if(working.current||!link)return;
    working.current=true;setBusy(true);setError('');setNotice('');
    try{
      const file=fileInput.current?.files?.[0],ext=EXT[file?.type];
      if(!ext||!file?.size||file.size>10485760)throw new Error(t('ارفع PDF أو صورة PNG أو JPG أو WebP بحجم لا يتجاوز 10 MB.','Upload a PDF, PNG, JPG or WebP up to 10 MB.'));
      const amount=Number(form.amount);
      if(!Number.isFinite(amount)||amount<=0||amount>1000000000||Math.abs(amount*100-Math.round(amount*100))>0.00001)throw new Error(t('أدخل مبلغًا صحيحًا بمنزلتين عشريتين كحد أقصى.','Enter a valid amount with at most two decimal places.'));
      if(!form.reference.trim())throw new Error(t('أدخل مرجع العملية.','Enter a payment reference.'));
      const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error(t('سجّل الدخول مجددًا.','Please sign in again.'));
      const fingerprint=await requestFingerprint(JSON.stringify({link:link.id,uid:session.user.id,amount,date:form.date,method:form.method,reference:form.reference.trim(),note:form.note.trim(),file:await requestFingerprint(await file.arrayBuffer())}));
      const token=requestIdentity(`proof:${fingerprint}`),path=`${session.user.id}/${token.id}.${ext}`;
      const {error:uploadError}=await supabase.storage.from('accounting-proofs').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'0'});
      if(uploadError){
        // The same content/form fingerprint reuses the same immutable object
        // after a lost response. No overwrite or second payment is created.
        const check=await supabase.storage.from('accounting-proofs').createSignedUrl(path,30);
        if(check.error)throw new Error(t('تعذر رفع الإيصال. احتفظ بالملف وأعد المحاولة.','Could not upload the proof. Keep the file and retry.'));
      }
      const {error:e}=await supabase.rpc('accounting_submit_payment',{p_id:token.id,p_link_id:link.id,p_amount:amount,p_payment_date:form.date,p_payment_method:form.method,p_reference:form.reference.trim(),p_note:form.note.trim(),p_proof_path:path});
      if(e)throw new Error(t('لم نتمكن من تأكيد استلام الطلب. حدّث القائمة أو أعد الإرسال بنفس البيانات؛ لن يتكرر الإيصال.','Could not confirm submission. Refresh or retry with the same details; the proof will not be duplicated.'));
      token.clear();setForm(blank());fileInput.current.value='';setNotice(t('وصل إيصالك للمراجعة. ستظهر نتيجة الاعتماد هنا.','Your proof was received for review. The review outcome will appear here.'));await load();
    }catch(e){setError(e.message);}finally{working.current=false;setBusy(false);}
  }
  async function openStatement(id) {
    setError('');setBusy(true);
    try{const {data,error:e}=await supabase.from('accounting_statements').select('payload').eq('id',id).single();if(e)throw e;setPreview(data.payload);}
    catch{setError(t('تعذر فتح الكشف. أعد المحاولة.','Could not open the statement. Please retry.'));}finally{setBusy(false);}
  }
  async function openFile(bucket,path) {
    if(busy)return;const w=window.open('about:blank','_blank');if(w)w.opener=null;setError('');setBusy(true);
    try{const {data,error:e}=await supabase.storage.from(bucket).createSignedUrl(path,120);if(e)throw e;if(!w)throw new Error();w.location.replace(data.signedUrl);}
    catch{w?.close();setError(t('تعذر فتح المستند. تأكد من السماح بالنوافذ المنبثقة وصلاحية حسابك.','Could not open the document. Check popup permissions and account access.'));}finally{setBusy(false);}
  }
  if(!link&&!error)return null;
  const s=latest?.payload?.summary;
  return <section id="accounting" className="acct-portal" dir={ar?'rtl':'ltr'}>
    <header><div><span className="acct-eyebrow"><ShieldCheck size={15}/> BALQEES · FINANCIAL DESK</span><h2>{t('حسابك مع مكتب بلقيس','Your Balqees financial account')}</h2><p>{t('كشوفك ومستحقاتك وإيصالات السداد في مكان واحد.','Your statements, dues and payment proofs in one place.')}</p></div><button onClick={load} disabled={loading||busy} aria-label={t('تحديث بيانات المحاسبة','Refresh accounting data')}><RefreshCw size={17} className={loading?'spin':''}/></button></header>
    {error&&<div className="acct-message error" role="alert">{error}</div>}{notice&&<div className="acct-message success" role="status">{notice}</div>}
    {link&&<><div className="acct-balance"><div><small>{s?(Number(s.closingBalance)<0?t('رصيد دائن لك حسب آخر كشف','Credit according to latest statement'):t('الرصيد حسب آخر كشف','Balance on latest statement')):t('رصيد الحساب','Account balance')}</small><strong dir="ltr">{s?money(s.closingBalance):'—'} <small>SAR</small></strong></div><div><small>{t('المتأخر حسب آخر كشف','Overdue on latest statement')}</small><strong dir="ltr">{s?money(s.overdueBalance):'—'} <small>SAR</small></strong></div></div>
    {latest?<div className="acct-doc-actions"><p className="acct-muted">{t('بيانات الكشف حتى','Statement through')} <bdi>{date(latest.payload.filters?.to)}</bdi><br/>{t('آخر إرسال:','Last published:')} <bdi>{date(latest.created_at)}</bdi></p><button onClick={()=>setPreview(latest.payload)}><FileText size={16}/>{t('عرض آخر كشف','View latest statement')}</button></div>:<p className="acct-muted">{t('حسابك مرتبط بالمكتب. سيظهر الرصيد عند إرسال أول كشف لك.','Your account is linked. The balance will appear when your first statement is published.')}</p>}
    <p className="acct-muted">{t('الرصيد نسخة بتاريخ الكشف؛ الإيصالات الجديدة تظهر في رصيد كشف لاحق بعد اعتمادها.','The balance is a dated snapshot. New proofs affect a later statement after approval.')}</p>
    <details><summary>{t('الكشوف والمستندات المحفوظة','Saved statements & documents')} · {history.length+docs.length}</summary><div className="acct-history">{history.map(h=><button key={h.id} onClick={()=>openStatement(h.id)} disabled={busy}><FileText size={18}/><span><strong>{t('كشف حساب','Account statement')} · <bdi>{h.statement_number}</bdi></strong><small>{date(h.created_at)}</small></span><ArrowUpRight size={17}/></button>)}{docs.map(d=><button key={d.id} onClick={()=>openFile('accounting-documents',d.file_path)} disabled={busy}><FileText size={18}/><span><strong>{d.title}</strong><small>{date(d.created_at)} · {d.file_name}</small></span><ArrowUpRight size={17}/></button>)}</div><small className="acct-muted">{t('آخر 30 كشفًا و50 مستندًا.','Latest 30 statements and 50 documents.')}</small></details>
    <form onSubmit={submit} className="acct-proof-form"><h3>{t('إرسال إيصال سداد للمكتب','Send a payment proof to Office')}</h3><p>{t('أرفق ما يثبت العملية للمراجعة. رفع الإيصال لا يعني اعتماد السداد.','Attach proof for review. Uploading does not certify payment.')}</p><fieldset disabled={busy}><div className="acct-form-grid"><label>{t('المبلغ بالريال','Amount (SAR)')}<input required type="number" min="0.01" step="0.01" max="1000000000" inputMode="decimal" value={form.amount} onChange={e=>patch('amount',e.target.value)}/></label><label>{t('تاريخ السداد','Payment date')}<input required type="date" min="2000-01-01" max={today()} value={form.date} onChange={e=>patch('date',e.target.value)}/></label><label>{t('طريقة السداد','Payment method')}<select value={form.method} onChange={e=>patch('method',e.target.value)}><option value="bank_transfer">{t('تحويل بنكي','Bank transfer')}</option><option value="card">{t('بطاقة','Card')}</option><option value="cash">{t('نقدي','Cash')}</option></select></label><label>{t('مرجع الحوالة أو إيصال السداد','Transfer or receipt reference')}<input required maxLength={120} value={form.reference} onChange={e=>patch('reference',e.target.value)}/></label></div><label>{t('ملاحظة (اختياري)','Note (optional)')}<textarea rows={2} maxLength={1200} value={form.note} onChange={e=>patch('note',e.target.value)}/></label><label>{t('إيصال السداد · PDF أو صورة · حتى 10 MB','Payment proof · PDF or image · up to 10 MB')}<input required ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg,image/webp"/></label><div className="acct-actions"><button className="acct-primary" type="submit"><Send size={16}/>{busy?t('جارٍ الإرسال…','Sending…'):t('إرسال الإيصال للمراجعة','Submit proof for review')}</button></div></fieldset></form>
    <details open={payments.length>0}><summary>{t('متابعة إيصالات السداد','Track payment proofs')} · {payments.length}</summary><div className="acct-inbox">{payments.map(p=><article key={p.id}><div className="acct-payment-title"><Wallet size={20}/><div><h3><bdi>{p.bank_reference}</bdi></h3><p>{date(p.payment_date)}</p></div><strong className="acct-amount" dir="ltr">{money(p.amount)} <small>SAR</small></strong></div><div className="acct-payment-details"><span className={`acct-status ${p.status}`}>{PAYMENT_STATES[p.status]?.[ar?0:1]}</span>{p.review_note&&<p>{p.review_note}</p>}</div><button disabled={busy} onClick={()=>openFile('accounting-proofs',p.proof_path)}>{t('عرض الإيصال','View proof')}</button></article>)}</div><p className="acct-muted">{t('آخر 50 إيصالًا.','Latest 50 proofs.')}</p></details></>}
    {preview&&<StatementPreview report={preview} onClose={()=>setPreview(null)} lang={lang}/>}
  </section>;
}
