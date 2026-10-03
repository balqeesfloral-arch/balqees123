import { useEffect, useMemo, useState } from 'react';
import { BadgePercent, CalendarClock, Check, Edit3, Plus, RefreshCw, Search, Target, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { dateOnly, logAdminAction, money } from '../adminUtils';

const empty = {
  id: null, name: '', code: '', kind: 'percent', value: 10,
  min_order: 0, max_discount: '', starts_at: '', ends_at: '',
  usage_limit: '', per_user_limit: 1, applies_to: 'all', target_ids: [], is_active: true,
};

export default function AdminDiscounts({ lang }) {
  const ar = lang === 'ar';
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [usage, setUsage] = useState({});
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const [d, p, c, r] = await Promise.all([
      supabase.from('discounts').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id,name_ar,name_en,sku').order('name_ar'),
      supabase.from('product_categories').select('id,name_ar,name_en').order('sort_order').order('name_ar'),
      supabase.from('discount_redemptions').select('discount_id'),
    ]);
    setRows(d.data || []);
    setProducts(p.data || []);
    setCategories(c.data || []);
    const counts = {};
    (r.data || []).forEach(item => { counts[item.discount_id] = (counts[item.discount_id] || 0) + 1; });
    setUsage(counts);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(x => `${x.name} ${x.code || ''}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  const targetOptions = form?.applies_to === 'product' ? products : categories;

  function edit(row) {
    setError('');
    setForm({
      ...row,
      code: row.code || '',
      starts_at: row.starts_at?.slice(0, 16) || '',
      ends_at: row.ends_at?.slice(0, 16) || '',
      max_discount: row.max_discount ?? '',
      usage_limit: row.usage_limit ?? '',
      target_ids: row.target_ids || [],
    });
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    const value = Number(form.value || 0);
    if (form.kind === 'percent' && value > 100) {
      setError(ar ? 'النسبة المئوية لا يمكن أن تتجاوز 100%.' : 'Percentage discounts cannot exceed 100%.');
      return;
    }
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) {
      setError(ar ? 'وقت نهاية الخصم يجب أن يكون بعد وقت البداية.' : 'Discount end time must be after the start time.');
      return;
    }
    if (form.applies_to !== 'all' && !(form.target_ids || []).length) {
      setError(ar ? 'اختر منتجًا أو صنفًا واحدًا على الأقل لتطبيق الخصم.' : 'Choose at least one product or category for this discount.');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase() || null,
      kind: form.kind,
      value,
      min_order: Number(form.min_order || 0),
      max_discount: form.max_discount === '' ? null : Number(form.max_discount),
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit),
      per_user_limit: Number(form.per_user_limit || 1),
      applies_to: form.applies_to,
      target_ids: form.applies_to === 'all' ? [] : (form.target_ids || []),
      is_active: form.is_active,
    };
    const req = form.id
      ? supabase.from('discounts').update(payload).eq('id', form.id).select().single()
      : supabase.from('discounts').insert(payload).select().single();
    const { data, error: dbError } = await req;
    if (!dbError) {
      await logAdminAction(form.id ? 'update_discount' : 'create_discount', 'discount', data.id, {
        name: data.name, code: data.code, applies_to: data.applies_to, targets: data.target_ids?.length || 0,
      });
      setForm(null);
      load();
    } else setError(dbError.message || (ar ? 'تعذر حفظ الخصم.' : 'Could not save discount.'));
    setSaving(false);
  }

  function scopeLabel(row) {
    if (row.applies_to === 'product') return ar ? `منتجات محددة (${row.target_ids?.length || 0})` : `Selected products (${row.target_ids?.length || 0})`;
    if (row.applies_to === 'category') return ar ? `أصناف محددة (${row.target_ids?.length || 0})` : `Selected categories (${row.target_ids?.length || 0})`;
    return ar ? 'كل المنتجات' : 'All products';
  }

  return <div className="admin-page">
    <div className="admin-page-head"><div><span>{ar ? 'التسعير الذكي' : 'SMART PRICING'}</span><h2>{ar ? 'إدارة الخصومات' : 'Discount management'}</h2><p>{ar ? 'خصومات شاملة أو موجهة لمنتجات وأصناف محددة، مع حدود استخدام وفترات صلاحية دقيقة.' : 'Create global or targeted discounts with precise validity windows and usage controls.'}</p></div><div className="admin-head-actions"><button className="admin-secondary-button" onClick={load}><RefreshCw className={loading ? 'spin' : ''} size={16}/>{ar ? 'تحديث' : 'Refresh'}</button><button className="admin-primary-button" onClick={() => { setError(''); setForm({ ...empty }); }}><Plus size={17}/>{ar ? 'خصم جديد' : 'New discount'}</button></div></div>

    <section className="admin-panel admin-table-shell"><div className="admin-toolbar"><div className="admin-search-field"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? 'ابحث بالاسم أو الكود…' : 'Search name or code…'}/></div></div><div className="admin-table-responsive"><table className="admin-table"><thead><tr><th>{ar ? 'الخصم' : 'Discount'}</th><th>{ar ? 'القيمة' : 'Value'}</th><th>{ar ? 'النطاق' : 'Scope'}</th><th>{ar ? 'الاستخدام' : 'Usage'}</th><th>{ar ? 'الفترة' : 'Window'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th/></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td><div className="admin-text-stack"><strong>{row.name}</strong><small dir="ltr">{row.code || '—'}</small></div></td><td><strong>{row.kind === 'percent' ? `${row.value}%` : money(row.value, lang)}</strong><small className="admin-table-sub">{row.min_order > 0 ? `${ar ? 'حد أدنى' : 'Min'} ${money(row.min_order, lang)}` : ''}</small></td><td><span className="admin-chip"><Target size={12}/>{scopeLabel(row)}</span></td><td><div className="admin-text-stack"><strong>{usage[row.id] || 0}{row.usage_limit != null ? ` / ${row.usage_limit}` : ''}</strong><small>{ar ? `لكل مستخدم: ${row.per_user_limit}` : `Per user: ${row.per_user_limit}`}</small></div></td><td><div className="admin-contact-lines"><span><CalendarClock size={13}/>{dateOnly(row.starts_at, lang)}</span><span>{dateOnly(row.ends_at, lang)}</span></div></td><td><span className={`admin-status-dot ${row.is_active ? 'active' : 'blocked'}`}>{row.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'متوقف' : 'Inactive')}</span></td><td><button className="admin-row-action" onClick={() => edit(row)}><Edit3 size={16}/></button></td></tr>)}</tbody></table></div>{!loading && !filtered.length && <div className="admin-empty-state"><BadgePercent size={29}/><strong>{ar ? 'لا توجد خصومات بعد' : 'No discounts yet'}</strong><p>{ar ? 'أنشئ أول خصم عندما تبدأ سياسة الأسعار والعروض.' : 'Create the first discount when your pricing strategy is ready.'}</p></div>}</section>

    {form && <div className="admin-modal-overlay" onMouseDown={e => e.target === e.currentTarget && setForm(null)}><div className="admin-modal wide"><div className="admin-modal-head"><div><small>DISCOUNT ENGINE</small><h3>{form.id ? (ar ? 'تعديل الخصم' : 'Edit discount') : (ar ? 'خصم جديد' : 'New discount')}</h3></div><button onClick={() => setForm(null)}><X size={19}/></button></div><form className="admin-modal-form" onSubmit={save}>
      {error && <div className="admin-form-error">{error}</div>}
      <div className="admin-form-grid two"><label>{ar ? 'اسم الخصم' : 'Discount name'}<input required value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}/></label><label>{ar ? 'كود الخصم' : 'Discount code'}<input dir="ltr" value={form.code} onChange={e => setForm(v => ({ ...v, code: e.target.value.toUpperCase() }))} placeholder="BALQEES10"/></label><label>{ar ? 'نوع الخصم' : 'Discount type'}<select value={form.kind} onChange={e => setForm(v => ({ ...v, kind: e.target.value }))}><option value="percent">{ar ? 'نسبة مئوية' : 'Percentage'}</option><option value="fixed">{ar ? 'مبلغ ثابت' : 'Fixed amount'}</option></select></label><label>{ar ? 'القيمة' : 'Value'}<input type="number" min="0" max={form.kind === 'percent' ? 100 : undefined} step="0.01" required value={form.value} onChange={e => setForm(v => ({ ...v, value: e.target.value }))}/></label><label>{ar ? 'الحد الأدنى للطلب' : 'Minimum order'}<input type="number" min="0" step="0.01" value={form.min_order} onChange={e => setForm(v => ({ ...v, min_order: e.target.value }))}/></label><label>{ar ? 'الحد الأقصى للخصم' : 'Maximum discount'}<input type="number" min="0" step="0.01" value={form.max_discount} onChange={e => setForm(v => ({ ...v, max_discount: e.target.value }))} placeholder={ar ? 'اختياري' : 'Optional'}/></label><label>{ar ? 'يبدأ' : 'Starts'}<input type="datetime-local" value={form.starts_at} onChange={e => setForm(v => ({ ...v, starts_at: e.target.value }))}/></label><label>{ar ? 'ينتهي' : 'Ends'}<input type="datetime-local" value={form.ends_at} onChange={e => setForm(v => ({ ...v, ends_at: e.target.value }))}/></label><label>{ar ? 'حد الاستخدام الكلي' : 'Total usage limit'}<input type="number" min="0" value={form.usage_limit} onChange={e => setForm(v => ({ ...v, usage_limit: e.target.value }))}/></label><label>{ar ? 'الحد لكل مستخدم' : 'Per-user limit'}<input type="number" min="1" value={form.per_user_limit} onChange={e => setForm(v => ({ ...v, per_user_limit: e.target.value }))}/></label></div>
      <div className="admin-form-section"><div className="admin-form-section-title"><Target size={17}/><div><strong>{ar ? 'نطاق تطبيق الخصم' : 'Discount scope'}</strong><small>{ar ? 'حدد هل يطبق على الجميع أو على أصناف/منتجات بعينها.' : 'Apply globally or only to selected categories/products.'}</small></div></div><div className="admin-form-grid two"><label>{ar ? 'يطبق على' : 'Applies to'}<select value={form.applies_to} onChange={e => setForm(v => ({ ...v, applies_to: e.target.value, target_ids: [] }))}><option value="all">{ar ? 'كل المنتجات' : 'All products'}</option><option value="category">{ar ? 'أصناف محددة' : 'Selected categories'}</option><option value="product">{ar ? 'منتجات محددة' : 'Selected products'}</option></select></label>{form.applies_to !== 'all' && <label>{form.applies_to === 'product' ? (ar ? 'اختر المنتجات' : 'Choose products') : (ar ? 'اختر الأصناف' : 'Choose categories')}<select multiple size="5" value={form.target_ids || []} onChange={e => setForm(v => ({ ...v, target_ids: [...e.target.selectedOptions].map(o => o.value) }))}>{targetOptions.map(item => <option key={item.id} value={item.id}>{item.name_ar}{item.sku ? ` · ${item.sku}` : ''}</option>)}</select><small className="admin-field-hint">{ar ? 'يمكن اختيار أكثر من عنصر باستخدام Ctrl / Command.' : 'Use Ctrl / Command to select multiple items.'}</small></label>}</div></div>
      <button type="button" className="admin-toggle-option" onClick={() => setForm(v => ({ ...v, is_active: !v.is_active }))}><span>{ar ? 'تفعيل الخصم' : 'Discount active'}</span><span className={`admin-switch ${form.is_active ? 'on' : ''}`}><i/></span></button><div className="admin-modal-actions"><button type="button" className="admin-secondary-button" onClick={() => setForm(null)}>{ar ? 'إلغاء' : 'Cancel'}</button><button className="admin-primary-button" disabled={saving}><Check size={16}/>{saving ? (ar ? 'جاري الحفظ…' : 'Saving…') : (ar ? 'حفظ الخصم' : 'Save discount')}</button></div>
    </form></div></div>}
  </div>;
}
