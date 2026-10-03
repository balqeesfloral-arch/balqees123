import { useEffect, useState } from 'react';
import { Check, Edit3, Gift, Plus, RefreshCw, Sparkles, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { dateOnly, logAdminAction } from '../adminUtils';
import AdminMediaUpload from '../AdminMediaUpload';

const empty = {
  id: null, title_ar: '', title_en: '', description_ar: '', description_en: '',
  badge_ar: '', badge_en: '', image_url: '', action_url: '', discount_id: '',
  starts_at: '', ends_at: '', is_active: false, is_featured: false,
};

export default function AdminOffers({ lang }) {
  const ar = lang === 'ar';
  const [rows, setRows] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const [o, d] = await Promise.all([
      supabase.from('offers').select('*').order('created_at', { ascending: false }),
      supabase.from('discounts').select('id,name,code,is_active').order('created_at', { ascending: false }),
    ]);
    setRows(o.data || []);
    setDiscounts(d.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) {
      setError(ar ? 'وقت نهاية العرض يجب أن يكون بعد وقت البداية.' : 'Offer end time must be after the start time.');
      return;
    }
    setSaving(true);
    const payload = {
      title_ar: form.title_ar.trim(),
      title_en: form.title_en.trim() || null,
      description_ar: form.description_ar.trim() || null,
      description_en: form.description_en.trim() || null,
      badge_ar: form.badge_ar.trim() || null,
      badge_en: form.badge_en.trim() || null,
      image_url: form.image_url.trim() || null,
      action_url: form.action_url.trim() || null,
      discount_id: form.discount_id || null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_active: form.is_active,
      is_featured: form.is_featured,
    };
    const req = form.id
      ? supabase.from('offers').update(payload).eq('id', form.id).select().single()
      : supabase.from('offers').insert(payload).select().single();
    const { data, error: dbError } = await req;
    if (!dbError) {
      await logAdminAction(form.id ? 'update_offer' : 'create_offer', 'offer', data.id, {
        title_ar: data.title_ar, is_active: data.is_active, is_featured: data.is_featured,
      });
      setForm(null);
      load();
    } else setError(dbError.message || (ar ? 'تعذر حفظ العرض.' : 'Could not save the offer.'));
    setSaving(false);
  }

  function edit(row) {
    setError('');
    setForm({
      ...row,
      discount_id: row.discount_id || '',
      starts_at: row.starts_at?.slice(0, 16) || '',
      ends_at: row.ends_at?.slice(0, 16) || '',
      title_en: row.title_en || '', description_ar: row.description_ar || '', description_en: row.description_en || '',
      badge_ar: row.badge_ar || '', badge_en: row.badge_en || '', image_url: row.image_url || '', action_url: row.action_url || '',
    });
  }

  return <div className="admin-page">
    <div className="admin-page-head"><div><span>{ar ? 'الحملات والعروض' : 'CAMPAIGNS'}</span><h2>{ar ? 'إدارة العروض' : 'Offer management'}</h2><p>{ar ? 'أنشئ حملات موسمية أو تجارية، اربطها بخصم، وارفع صورة العرض مباشرة وحدد وقت ظهورها.' : 'Create seasonal or commercial campaigns, link discounts, upload campaign media and control display windows.'}</p></div><div className="admin-head-actions"><button className="admin-secondary-button" onClick={load}><RefreshCw className={loading ? 'spin' : ''} size={16}/>{ar ? 'تحديث' : 'Refresh'}</button><button className="admin-primary-button" onClick={() => { setError(''); setForm({ ...empty }); }}><Plus size={17}/>{ar ? 'عرض جديد' : 'New offer'}</button></div></div>

    <div className="admin-offer-grid">{rows.map(row => <article key={row.id} className={`admin-offer-card ${row.is_featured ? 'featured' : ''}`}><div className="admin-offer-visual">{row.image_url ? <img src={row.image_url} alt=""/> : <Gift size={34}/>} {row.is_featured && <span><Sparkles size={13}/>{ar ? 'مميز' : 'Featured'}</span>}</div><div className="admin-offer-copy"><small>{(ar ? row.badge_ar : row.badge_en) || row.badge_ar || row.badge_en || 'BALQEES OFFER'}</small><h3>{ar ? row.title_ar : (row.title_en || row.title_ar)}</h3><p>{ar ? (row.description_ar || '—') : (row.description_en || row.description_ar || '—')}</p><div><span>{dateOnly(row.starts_at, lang)}</span><b>→</b><span>{dateOnly(row.ends_at, lang)}</span></div></div><footer><span className={`admin-status-dot ${row.is_active ? 'active' : 'blocked'}`}>{row.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'مسودة/متوقف' : 'Draft / inactive')}</span><button onClick={() => edit(row)}><Edit3 size={16}/></button></footer></article>)}{!loading && !rows.length && <div className="admin-empty-state admin-grid-empty"><Gift size={30}/><strong>{ar ? 'لا توجد عروض حتى الآن' : 'No offers yet'}</strong><p>{ar ? 'جهّز أول حملة عندما تكون مستعدًا لإطلاق العروض.' : 'Create your first campaign when you are ready.'}</p></div>}</div>

    {form && <div className="admin-modal-overlay" onMouseDown={e => e.target === e.currentTarget && setForm(null)}><div className="admin-modal wide"><div className="admin-modal-head"><div><small>OFFER STUDIO</small><h3>{form.id ? (ar ? 'تعديل العرض' : 'Edit offer') : (ar ? 'إنشاء عرض' : 'Create offer')}</h3></div><button onClick={() => setForm(null)}><X size={19}/></button></div><form className="admin-modal-form" onSubmit={save}>
      {error && <div className="admin-form-error">{error}</div>}
      <div className="admin-form-grid two"><label>{ar ? 'عنوان العرض بالعربية' : 'Arabic title'}<input required value={form.title_ar} onChange={e => setForm(v => ({ ...v, title_ar: e.target.value }))}/></label><label>{ar ? 'العنوان بالإنجليزية' : 'English title'}<input value={form.title_en} onChange={e => setForm(v => ({ ...v, title_en: e.target.value }))}/></label><label>{ar ? 'شارة بالعربية' : 'Arabic badge'}<input value={form.badge_ar} onChange={e => setForm(v => ({ ...v, badge_ar: e.target.value }))} placeholder={ar ? 'حصري، موسمي…' : 'Exclusive, Seasonal…'}/></label><label>{ar ? 'شارة بالإنجليزية' : 'English badge'}<input value={form.badge_en} onChange={e => setForm(v => ({ ...v, badge_en: e.target.value }))} placeholder="Exclusive"/></label><label>{ar ? 'ربط بخصم' : 'Linked discount'}<select value={form.discount_id} onChange={e => setForm(v => ({ ...v, discount_id: e.target.value }))}><option value="">{ar ? 'بدون خصم مرتبط' : 'No linked discount'}</option>{discounts.map(d => <option key={d.id} value={d.id}>{d.name} {d.code ? `(${d.code})` : ''}{!d.is_active ? (ar ? ' · متوقف' : ' · inactive') : ''}</option>)}</select></label><label>{ar ? 'رابط الإجراء' : 'Action URL'}<input dir="ltr" value={form.action_url} onChange={e => setForm(v => ({ ...v, action_url: e.target.value }))} placeholder="/services"/></label></div>
      <div className="admin-form-grid two"><label>{ar ? 'وصف العرض بالعربية' : 'Arabic description'}<textarea rows="4" value={form.description_ar} onChange={e => setForm(v => ({ ...v, description_ar: e.target.value }))}/></label><label>{ar ? 'الوصف بالإنجليزية' : 'English description'}<textarea rows="4" value={form.description_en} onChange={e => setForm(v => ({ ...v, description_en: e.target.value }))}/></label></div>
      <div className="admin-form-grid two"><label>{ar ? 'يبدأ' : 'Starts'}<input type="datetime-local" value={form.starts_at} onChange={e => setForm(v => ({ ...v, starts_at: e.target.value }))}/></label><label>{ar ? 'ينتهي' : 'Ends'}<input type="datetime-local" value={form.ends_at} onChange={e => setForm(v => ({ ...v, ends_at: e.target.value }))}/></label></div>
      <AdminMediaUpload lang={lang} folder="offers" value={form.image_url} onChange={value => setForm(v => ({ ...v, image_url: value }))} label={ar ? 'صورة العرض' : 'Offer image'}/>
      <div className="admin-toggle-row"><Toggle label={ar ? 'العرض نشط' : 'Offer active'} checked={form.is_active} onChange={() => setForm(v => ({ ...v, is_active: !v.is_active }))}/><Toggle label={ar ? 'عرض مميز' : 'Featured campaign'} checked={form.is_featured} onChange={() => setForm(v => ({ ...v, is_featured: !v.is_featured }))}/></div><div className="admin-modal-actions"><button type="button" className="admin-secondary-button" onClick={() => setForm(null)}>{ar ? 'إلغاء' : 'Cancel'}</button><button className="admin-primary-button" disabled={saving}><Check size={16}/>{saving ? (ar ? 'جاري الحفظ…' : 'Saving…') : (ar ? 'حفظ العرض' : 'Save offer')}</button></div>
    </form></div></div>}
  </div>;
}

function Toggle({ label, checked, onChange }) { return <button type="button" className="admin-toggle-option" onClick={onChange}><span>{label}</span><span className={`admin-switch ${checked ? 'on' : ''}`}><i/></span></button>; }
