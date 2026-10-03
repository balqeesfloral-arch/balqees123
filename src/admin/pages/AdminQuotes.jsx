import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, CopyPlus, FileText, LoaderCircle, Pencil, Plus, RefreshCw,
  Send, Trash2, Upload, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDate, openPrivateDocument, quoteLabels, sar, statusTone } from '../../client/portalUtils';
import '../../client/quotation-decision-room.css';

const blankLine=()=>({
  line_key:crypto.randomUUID?.()||undefined,
  description_ar:'',description_en:'',quantity:1,unit_ar:'قطعة',unit_en:'piece',unit_price:0,discount:0,
});
const blankForm=()=>({
  edit_id:null,organization_id:'',service_request_id:'',site_id:'',title_ar:'عرض سعر',title_en:'Quotation',
  valid_until:'',vat_rate:15,prices_include_vat:true,terms_ar:'',terms_en:'',send_now:false,
  document_path:'',lines:[blankLine()],
});

export default function AdminQuotes({lang}){
  const ar=lang==='ar';
  const[orgs,setOrgs]=useState([]);const[sites,setSites]=useState([]);const[requests,setRequests]=useState([]);
  const[rows,setRows]=useState([]);const[loading,setLoading]=useState(true);const[show,setShow]=useState(false);
  const[busy,setBusy]=useState(false);const[msg,setMsg]=useState('');const[form,setForm]=useState(blankForm());
  const[pdfFile,setPdfFile]=useState(null);

  async function load(){
    setLoading(true);
    const[o,s,r,q]=await Promise.all([
      supabase.from('organizations').select('id,display_name').order('display_name'),
      supabase.from('organization_sites').select('id,organization_id,name_ar,name_en,is_active').eq('is_active',true),
      supabase.from('organization_service_requests').select('id,request_code,organization_id,site_id,status,service_type,description').neq('status','draft').order('created_at',{ascending:false}).limit(300),
      supabase.from('quotations').select('*,quotation_items(*)').order('updated_at',{ascending:false}).limit(250),
    ]);
    setOrgs(o.data||[]);setSites(s.data||[]);setRequests(r.data||[]);setRows(q.data||[]);setLoading(false);
  }
  useEffect(()=>{load();},[]);

  const orgMap=useMemo(()=>Object.fromEntries(orgs.map(o=>[o.id,o])),[orgs]);
  const siteMap=useMemo(()=>Object.fromEntries(sites.map(s=>[s.id,s])),[sites]);
  const requestMap=useMemo(()=>Object.fromEntries(requests.map(r=>[r.id,r])),[requests]);
  const currentRows=useMemo(()=>rows.filter(q=>q.is_current),[rows]);
  const filteredSites=sites.filter(s=>s.organization_id===form.organization_id);
  const filteredRequests=requests.filter(r=>r.organization_id===form.organization_id);

  function line(i,key,val){setForm(f=>({...f,lines:f.lines.map((x,n)=>n===i?{...x,[key]:val}:x)}));}
  function newQuote(){setForm({...blankForm(),organization_id:orgs[0]?.id||''});setPdfFile(null);setMsg('');setShow(true);}
  function editQuote(q){
    setForm({
      edit_id:q.id,organization_id:q.organization_id,service_request_id:q.service_request_id||'',site_id:q.site_id||'',
      title_ar:q.title_ar,title_en:q.title_en||'',valid_until:q.valid_until||'',vat_rate:Number(q.vat_rate||15),
      prices_include_vat:Boolean(q.prices_include_vat),terms_ar:q.terms_ar||'',terms_en:q.terms_en||'',send_now:false,
      document_path:q.document_path||'',
      lines:(q.quotation_items||[]).sort((a,b)=>a.sort_order-b.sort_order).map(i=>({...i})),
    });
    setPdfFile(null);setMsg('');setShow(true);
  }

  async function uploadOfficialPdf(orgId,qid){
    if(!pdfFile)return null;
    if(pdfFile.type&&pdfFile.type!=='application/pdf')throw new Error('PDF_REQUIRED');
    if(pdfFile.size>20*1024*1024)throw new Error('PDF_TOO_LARGE');
    const path=`${orgId}/quotations/${qid}/${crypto.randomUUID()}.pdf`;
    const{error}=await supabase.storage.from('client-documents').upload(path,pdfFile,{contentType:'application/pdf',upsert:false});
    if(error)throw error;
    return path;
  }

  async function save(e){
    e.preventDefault();
    if(!form.organization_id||!form.lines.some(x=>x.description_ar.trim()))return;
    setBusy(true);setMsg('');
    let qid=form.edit_id;let oldPath=form.document_path||'';let uploadedPath=null;
    try{
      const user=(await supabase.auth.getUser()).data.user;
      if(qid){
        const{error}=await supabase.from('quotations').update({
          title_ar:form.title_ar.trim(),title_en:form.title_en.trim()||null,valid_until:form.valid_until||null,
          vat_rate:Number(form.vat_rate||0),prices_include_vat:form.prices_include_vat,
          terms_ar:form.terms_ar.trim()||null,terms_en:form.terms_en.trim()||null,
          service_request_id:form.service_request_id||null,site_id:form.site_id||null,
        }).eq('id',qid).eq('status','draft').eq('is_current',true);
        if(error)throw error;
        const{error:delErr}=await supabase.from('quotation_items').delete().eq('quotation_id',qid);
        if(delErr)throw delErr;
      }else{
        const{data:q,error}=await supabase.from('quotations').insert({
          organization_id:form.organization_id,title_ar:form.title_ar.trim(),title_en:form.title_en.trim()||null,
          valid_until:form.valid_until||null,vat_rate:Number(form.vat_rate||0),prices_include_vat:form.prices_include_vat,
          terms_ar:form.terms_ar.trim()||null,terms_en:form.terms_en.trim()||null,status:'draft',created_by:user?.id,
          service_request_id:form.service_request_id||null,site_id:form.site_id||null,
        }).select().single();
        if(error||!q)throw error||new Error('QUOTE_CREATE_FAILED');
        qid=q.id;
      }

      const items=form.lines.filter(x=>x.description_ar.trim()).map((x,i)=>({
        quotation_id:qid,line_key:x.line_key||undefined,description_ar:x.description_ar.trim(),
        description_en:x.description_en?.trim()||null,quantity:Number(x.quantity||1),unit_ar:x.unit_ar||'قطعة',
        unit_en:x.unit_en||'piece',unit_price:Number(x.unit_price||0),discount:Number(x.discount||0),sort_order:i,
      }));
      const{error:ie}=await supabase.from('quotation_items').insert(items);if(ie)throw ie;

      uploadedPath=await uploadOfficialPdf(form.organization_id,qid);
      if(uploadedPath){
        const{error:pe}=await supabase.from('quotations').update({document_path:uploadedPath}).eq('id',qid).eq('status','draft').eq('is_current',true);
        if(pe)throw pe;
      }

      if(form.send_now){
        const{error:se}=await supabase.from('quotations').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',qid).eq('status','draft').eq('is_current',true);
        if(se)throw se;
      }

      if(uploadedPath&&oldPath&&oldPath!==uploadedPath){await supabase.storage.from('client-documents').remove([oldPath]);}
      setShow(false);setPdfFile(null);await load();
    }catch(err){
      if(uploadedPath)await supabase.storage.from('client-documents').remove([uploadedPath]);
      const code=String(err?.message||'');
      setMsg(code.includes('PDF_REQUIRED')?(ar?'الملف الرسمي يجب أن يكون PDF.':'The official document must be a PDF.'):
        code.includes('PDF_TOO_LARGE')?(ar?'حجم PDF يتجاوز 20MB.':'PDF exceeds 20MB.'):
        (ar?'تعذر حفظ إصدار العرض أو ملفه الرسمي.':'Could not save the quotation version or its official document.'));
    }
    setBusy(false);
  }

  async function sendQuote(q){
    setBusy(true);setMsg('');
    const{error}=await supabase.from('quotations').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',q.id).eq('status','draft').eq('is_current',true);
    if(error)setMsg(ar?'تعذر إرسال العرض.':'Could not send quotation.');
    await load();setBusy(false);
  }
  async function createRevision(q){
    setBusy(true);setMsg('');
    const{data,error}=await supabase.rpc('create_quotation_revision',{p_quote_id:q.id});
    if(error){setMsg(ar?'تعذر إنشاء إصدار جديد.':'Could not create a new version.');setBusy(false);return;}
    await load();const{data:fresh}=await supabase.from('quotations').select('*,quotation_items(*)').eq('id',data).single();
    if(fresh)editQuote(fresh);setBusy(false);
  }
  async function remove(q){
    if(q.status!=='draft'||!q.is_current)return;
    if(!window.confirm(ar?'حذف مسودة عرض السعر؟':'Delete this quotation draft?'))return;
    const{error}=await supabase.from('quotations').delete().eq('id',q.id);if(error)return;
    if(q.document_path)await supabase.storage.from('client-documents').remove([q.document_path]);
    await load();
  }

  return <div className="admin-page">
    <header className="admin-page-head"><div><span>COMMERCIAL DECISION ROOM</span><h2>{ar?'عروض أسعار المنشآت':'Organization quotations'}</h2><p>{ar?'أنشئ V1، وارفع نسخته الرسمية، ثم أنشئ V2/V3 عند طلب التعديل مع حفظ المقارنة وسجل القرار تلقائيًا.':'Create V1 with its official PDF, then issue V2/V3 revisions while preserving comparison and decision history.'}</p></div><div className="admin-head-actions"><button className="admin-secondary-button" onClick={load}><RefreshCw className={loading?'spin':''}/>{ar?'تحديث':'Refresh'}</button><button className="admin-primary-button" onClick={newQuote}><Plus/>{ar?'عرض جديد':'New quotation'}</button></div></header>
    {msg&&<div className="admin-form-error">{msg}</div>}
    <div className="admin-data-card"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>#</th><th>{ar?'الإصدار':'Version'}</th><th>{ar?'المنشأة / الموقع':'Organization / site'}</th><th>{ar?'العنوان':'Title'}</th><th>{ar?'الإجمالي':'Total'}</th><th>{ar?'الحالة':'Status'}</th><th/></tr></thead><tbody>{currentRows.map(q=><tr key={q.id}><td><strong>Q-{String(q.quote_number).padStart(5,'0')}</strong><small style={{display:'block'}}>V{q.version_number}</small></td><td>V{q.version_number}{q.previous_quote_id&&<small style={{display:'block'}}>{ar?'إصدار معدل':'Revision'}</small>}{q.document_path&&<small style={{display:'block',color:'#8d7442'}}>{ar?'PDF رسمي':'Official PDF'}</small>}</td><td><strong>{orgMap[q.organization_id]?.display_name||'—'}</strong><small style={{display:'block'}}>{siteMap[q.site_id]?.name_ar||requestMap[q.service_request_id]?.request_code||'—'}</small></td><td>{ar?q.title_ar:(q.title_en||q.title_ar)}<small style={{display:'block'}}>{fmtDate(q.valid_until,lang)}</small></td><td><strong>{sar(q.total,lang)}</strong></td><td><span className={`admin-status ${statusTone(q.status)}`}>{quoteLabels[lang][q.status]||q.status}</span></td><td><div className="admin-row-actions">{q.document_path&&<button onClick={()=>openPrivateDocument(q.document_path)} title={ar?'فتح PDF الرسمي':'Open official PDF'}><FileText/></button>}{q.status==='draft'&&<><button onClick={()=>editQuote(q)} title={ar?'تعديل':'Edit'}><Pencil/></button><button onClick={()=>sendQuote(q)} title={ar?'إرسال':'Send'}><Send/></button><button className="danger" onClick={()=>remove(q)}><Trash2/></button></>}{q.status==='revision_requested'&&<button onClick={()=>createRevision(q)} title={ar?'إنشاء إصدار معدل':'Create revision'}><CopyPlus/></button>}</div></td></tr>)}</tbody></table>{!currentRows.length&&!loading&&<div className="admin-empty-state"><FileText/><strong>{ar?'لا توجد عروض أسعار بعد':'No quotations yet'}</strong></div>}</div></div>

    {show&&<div className="admin-modal-overlay" onMouseDown={e=>e.target===e.currentTarget&&setShow(false)}><form className="admin-modal admin-quote-modal" onSubmit={save}><header><div><small>{form.edit_id?'EDIT VERSION':'NEW QUOTATION'}</small><h3>{form.edit_id?(ar?'تحرير إصدار العرض':'Edit quotation version'):(ar?'إنشاء عرض سعر':'Create quotation')}</h3></div><button type="button" onClick={()=>setShow(false)}><X/></button></header>
      <div className="admin-form-grid"><label>{ar?'المنشأة':'Organization'}<select value={form.organization_id} onChange={e=>setForm({...form,organization_id:e.target.value,service_request_id:'',site_id:''})} required disabled={Boolean(form.edit_id)}><option value="">—</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.display_name}</option>)}</select></label><label>{ar?'الموقع':'Site'}<select value={form.site_id} onChange={e=>setForm({...form,site_id:e.target.value})}><option value="">—</option>{filteredSites.map(s=><option key={s.id} value={s.id}>{ar?s.name_ar:(s.name_en||s.name_ar)}</option>)}</select></label><label className="wide">{ar?'طلب المنشأة المرتبط':'Linked service request'}<select value={form.service_request_id} onChange={e=>{const req=requestMap[e.target.value];setForm({...form,service_request_id:e.target.value,site_id:req?.site_id||form.site_id})}}><option value="">—</option>{filteredRequests.map(r=><option key={r.id} value={r.id}>{r.request_code} · {r.description?.slice(0,70)||r.service_type}</option>)}</select></label><label>{ar?'صالح حتى':'Valid until'}<input type="date" value={form.valid_until} onChange={e=>setForm({...form,valid_until:e.target.value})}/></label><label>{ar?'الضريبة %':'VAT %'}<input type="number" value={form.vat_rate} onChange={e=>setForm({...form,vat_rate:e.target.value})}/></label><label>{ar?'العنوان بالعربية':'Arabic title'}<input value={form.title_ar} onChange={e=>setForm({...form,title_ar:e.target.value})} required/></label><label>{ar?'العنوان بالإنجليزية':'English title'}<input value={form.title_en} onChange={e=>setForm({...form,title_en:e.target.value})}/></label></div>
      <div className="admin-quote-lines"><div className="admin-quote-lines-head"><strong>{ar?'بنود العرض':'Quotation items'}</strong><button type="button" className="admin-secondary-button small" onClick={()=>setForm(f=>({...f,lines:[...f.lines,blankLine()]}))}><Plus/>{ar?'إضافة بند':'Add line'}</button></div>{form.lines.map((x,i)=><div className="admin-quote-line" key={x.line_key||i}><input value={x.description_ar} onChange={e=>line(i,'description_ar',e.target.value)} placeholder={ar?'الوصف بالعربية':'Arabic description'} required/><input value={x.description_en||''} onChange={e=>line(i,'description_en',e.target.value)} placeholder={ar?'الوصف بالإنجليزية':'English description'}/><input type="number" min="0.01" step="0.01" value={x.quantity} onChange={e=>line(i,'quantity',e.target.value)}/><input type="number" min="0" step="0.01" value={x.unit_price} onChange={e=>line(i,'unit_price',e.target.value)}/><input type="number" min="0" step="0.01" value={x.discount} onChange={e=>line(i,'discount',e.target.value)}/><button type="button" onClick={()=>setForm(f=>({...f,lines:f.lines.filter((_,n)=>n!==i)}))} disabled={form.lines.length===1}><Trash2/></button></div>)}</div>
      <div className="admin-form-grid"><label className="wide">{ar?'الشروط بالعربية':'Arabic terms'}<textarea rows="3" value={form.terms_ar} onChange={e=>setForm({...form,terms_ar:e.target.value})}/></label><label className="wide">{ar?'الشروط بالإنجليزية':'English terms'}<textarea rows="3" value={form.terms_en} onChange={e=>setForm({...form,terms_en:e.target.value})}/></label><label className="wide admin-quote-file-label"><span><Upload/>{ar?'PDF الرسمي لهذا الإصدار':'Official PDF for this version'}</span><input type="file" accept="application/pdf,.pdf" onChange={e=>setPdfFile(e.target.files?.[0]||null)}/><small>{pdfFile?.name||(form.document_path?(ar?'يوجد PDF رسمي محفوظ — ارفع ملفًا جديدًا لاستبداله.':'An official PDF is already stored — upload a new file to replace it.'):(ar?'اختياري، بحد أقصى 20MB.':'Optional, max 20MB.'))}</small></label></div>
      <label className="admin-check-row"><input type="checkbox" checked={form.prices_include_vat} onChange={e=>setForm({...form,prices_include_vat:e.target.checked})}/><span>{ar?'الأسعار تشمل الضريبة':'Prices include VAT'}</span></label><label className="admin-check-row"><input type="checkbox" checked={form.send_now} onChange={e=>setForm({...form,send_now:e.target.checked})}/><span>{ar?'إرسال للمنشأة مباشرة بعد الحفظ':'Send to organization immediately after saving'}</span></label>{msg&&<div className="admin-form-error">{msg}</div>}<footer><button type="button" className="admin-secondary-button" onClick={()=>setShow(false)}>{ar?'إلغاء':'Cancel'}</button><button className="admin-primary-button" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<CheckCircle2/>}{ar?'حفظ الإصدار':'Save version'}</button></footer>
    </form></div>}
  </div>;
}
