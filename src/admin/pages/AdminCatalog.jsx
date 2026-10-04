import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgePercent, Boxes, Calculator, Check, CheckSquare2, Copy, Edit3, Eye, EyeOff,
  FolderPlus, ImagePlus, Layers3, PackagePlus, Percent, Plus, RefreshCw, Search,
  Sparkles, Tags, Trash2, TrendingUp, WandSparkles, X,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { resolveProductPrice } from '../../lib/storePricing';
import { validateProduct, PRODUCT_VALIDATION_MESSAGES, catalogError, matchesCatalogFilter } from '../catalogValidation';
import AdminStoreStatus from '../AdminStoreStatus';
import useAdminLiveRefresh, { notifyAdminChange } from '../useAdminLiveRefresh';
import { supabase } from '../../lib/supabase';
import { dateOnly, logAdminAction, money, normalizeSlug } from '../adminUtils';
import AdminMediaUpload from '../AdminMediaUpload';
import AdminGalleryUpload from '../AdminGalleryUpload';

const emptyProduct = {
  id: null, category_id: '', sku: '', slug: '', name_ar: '', name_en: '',
  short_description_ar: '', short_description_en: '', description_ar: '', description_en: '',
  base_price: '', sale_price: '', sale_starts_at: '', sale_ends_at: '', price_on_request: false,
  stock_mode: 'made_to_order', stock_quantity: 0, min_order_quantity: 1, max_order_quantity: '',
  unit_ar: 'قطعة', unit_en: 'piece', lead_time_ar: '', lead_time_en: '', image_url: '', gallery: [], tags: '',
  is_active: true, is_featured: false, visibility: 'draft', exclude_auto_pricing: false,
  cost_price: '', target_margin_percent: 35, low_stock_threshold: 3, supplier_name: '', internal_note: '',
};
const emptyCategory = { id: null, name_ar: '', name_en: '', slug: '', description_ar: '', description_en: '', image_url: '', is_active: true, sort_order: 0 };
const emptyRule = {
  id: null, name_ar: '', name_en: '', badge_ar: '', badge_en: '', scope: 'all', target_ids: [], target_tags: '',
  rule_type: 'percent', value: 10, starts_at: '', ends_at: '', priority: 100, is_active: true,
};

const scopeRank = { product: 4, category: 3, tag: 2, all: 1 };

function activeNow(row) {
  const now = Date.now();
  return row?.is_active && (!row.starts_at || new Date(row.starts_at).getTime() <= now) && (!row.ends_at || new Date(row.ends_at).getTime() >= now);
}
function ruleMatches(rule, product) {
  if (!rule || !product) return false;
  if (rule.scope === 'all') return true;
  if (rule.scope === 'product') return (rule.target_ids || []).includes(product.id);
  if (rule.scope === 'category') return !!product.category_id && (rule.target_ids || []).includes(product.category_id);
  if (rule.scope === 'tag') return (product.tags || []).some(tag => (rule.target_tags || []).includes(tag));
  return false;
}
function currentPrice(product, rules) { return resolveProductPrice(product, rules).effective; }

export default function AdminCatalog({ lang }) {
  const ar = lang === 'ar';
  const location = useLocation();
  const navigate = useNavigate();
  const loadId = useRef(0);
  const [filter, setFilter] = useState('all');
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [costs, setCosts] = useState({});
  const [rules, setRules] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());

  async function load(showLoading = true) {
    const id = ++loadId.current;
    if (showLoading) setLoading(true);
    setLoadError('');
    try {
      const [p, c, pc, pr] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('product_categories').select('*').order('sort_order').order('created_at'),
        supabase.from('product_costs').select('*'),
        supabase.from('price_rules').select('*').order('priority', { ascending: false }).order('created_at', { ascending: false }),
      ]);
      if (id !== loadId.current) return;
      if (!p.error) {
        setProducts(p.data || []);
        const ids = new Set((p.data || []).map(row => row.id));
        setSelected(current => new Set([...current].filter(key => ids.has(key))));
      }
      if (!c.error) setCategories(c.data || []);
      if (!pc.error) setCosts(Object.fromEntries((pc.data || []).map(row => [row.product_id, row])));
      if (!pr.error) setRules(pr.data || []);
      if ([p, c, pc, pr].some(result => result.error)) setLoadError(ar ? 'تعذر تحميل جزء من الكتالوج. أعد المحاولة قبل تعديل البيانات غير المتاحة.' : 'Part of the catalog could not load. Retry before editing unavailable data.');
    } catch { if (id === loadId.current) setLoadError(ar ? 'تعذر الاتصال بالكتالوج. حاول مجددًا.' : 'Could not connect to the catalog. Please retry.'); }
    finally { if (id === loadId.current) setLoading(false); }
  }
  useEffect(() => { load(); return () => { ++loadId.current; }; }, []);
  useAdminLiveRefresh(() => { if (!modal && !saving) load(false); }, ['products', 'product_categories', 'product_costs', 'price_rules']);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (['products', 'categories', 'pricing'].includes(params.get('tab'))) setTab(params.get('tab'));
    setFilter(params.get('filter') || 'all');
  }, [location.search]);

  const categoryMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories]);
  const filteredProducts = useMemo(() => products.filter(p => matchesCatalogFilter(p, filter) && `${p.name_ar} ${p.name_en || ''} ${p.sku || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(query.toLowerCase())), [products, query, filter]);
  const filteredCategories = useMemo(() => categories.filter(c => `${c.name_ar} ${c.name_en || ''} ${c.slug}`.toLowerCase().includes(query.toLowerCase())), [categories, query]);
  const filteredRules = useMemo(() => rules.filter(r => `${r.name_ar} ${r.name_en || ''} ${r.badge_ar || ''}`.toLowerCase().includes(query.toLowerCase())), [rules, query]);

  const metrics = useMemo(() => {
    const priced = products.filter(p => !p.price_on_request && Number(p.base_price || 0) > 0);
    let marginTotal = 0, marginCount = 0, low = 0;
    priced.forEach(p => {
      const cost = Number(costs[p.id]?.cost_price || 0);
      const sell = currentPrice(p, rules);
      if (cost > 0 && sell > 0) { marginTotal += ((sell - cost) / sell) * 100; marginCount += 1; }

    });
    low = products.filter(p => p.stock_mode === 'tracked' && Number(p.stock_quantity || 0) <= Number(costs[p.id]?.low_stock_threshold || 0)).length;
    return { public: products.filter(p => p.visibility === 'public' && p.is_active).length, featured: products.filter(p => p.is_featured).length, low, avgMargin: marginCount ? marginTotal / marginCount : 0 };
  }, [products, costs, rules]);

  function makeSku() { return `BLQ-${Date.now().toString(36).slice(-5).toUpperCase()}`; }
  function openProduct(item = null) {
    if (loadError) { setError(ar ? 'أعد تحميل الكتالوج قبل تعديل المنتج.' : 'Reload the catalog before editing a product.'); return; }
    setError('');
    const cost = item ? costs[item.id] || {} : {};
    const next = item ? {
      ...emptyProduct, ...item,
      category_id: item.category_id || '', slug: item.slug || '', base_price: item.base_price ?? '', sale_price: item.sale_price ?? '',
      sale_starts_at: item.sale_starts_at?.slice(0,16) || '', sale_ends_at: item.sale_ends_at?.slice(0,16) || '',
      max_order_quantity: item.max_order_quantity ?? '', gallery: Array.isArray(item.gallery) ? item.gallery : [], tags: (item.tags || []).join(', '),
      cost_price: cost.cost_price ?? '', target_margin_percent: cost.target_margin_percent ?? 35,
      low_stock_threshold: cost.low_stock_threshold ?? 3, supplier_name: cost.supplier_name || '', internal_note: cost.internal_note || '',
    } : { ...emptyProduct, sku: makeSku(), gallery: [] };
    setProductForm(next); setModal('product');
  }
  function openCategory(item = null) { setError(''); setCategoryForm(item ? { ...emptyCategory, ...item } : { ...emptyCategory }); setModal('category'); }
  function openRule(item = null, preset = null) {
    setError('');
    if (item) setRuleForm({ ...emptyRule, ...item, target_ids: item.target_ids || [], target_tags: (item.target_tags || []).join(', '), starts_at: item.starts_at?.slice(0,16) || '', ends_at: item.ends_at?.slice(0,16) || '' });
    else setRuleForm({ ...emptyRule, ...(preset || {}) });
    setModal('rule');
  }

  useEffect(() => {
    if (loading || loadError || saving) return;
    const params = new URLSearchParams(location.search);
    if (params.get('new') === 'product') openProduct();
    else if (params.get('edit')) {
      const item = products.find(row => row.id === params.get('edit'));
      if (item) openProduct(item);
      else setError(ar ? 'المنتج المطلوب غير موجود.' : 'The requested product was not found.');
    } else return;
    params.delete('new'); params.delete('edit');
    navigate({ pathname: '/admin/catalog', search: params.toString() ? `?${params}` : '' }, { replace: true });
  }, [loading, loadError, location.search, products, saving]);

  const previewCost = Number(productForm.cost_price || 0);
  const previewSell = productForm.price_on_request ? 0 : Number(productForm.sale_price === '' || productForm.sale_price === null ? productForm.base_price || 0 : productForm.sale_price);
  const previewProfit = previewSell - previewCost;
  const previewMargin = previewSell > 0 ? (previewProfit / previewSell) * 100 : 0;
  const suggestedPrice = previewCost > 0 && Number(productForm.target_margin_percent || 0) < 100
    ? previewCost / (1 - Number(productForm.target_margin_percent || 0) / 100) : 0;

  async function saveProduct(e) {
    e.preventDefault(); setError('');
    const validation = validateProduct(productForm);
    if (validation) { setError(PRODUCT_VALIDATION_MESSAGES[validation][ar ? 0 : 1]); return; }
    setSaving(true);
    const slugBase = productForm.slug || productForm.name_en || productForm.sku || productForm.name_ar;
    const payload = {
      category_id: productForm.category_id || null,
      sku: productForm.sku.trim() || makeSku(),
      slug: normalizeSlug(slugBase),
      name_ar: productForm.name_ar.trim(), name_en: productForm.name_en.trim(),
      short_description_ar: productForm.short_description_ar.trim() || null, short_description_en: productForm.short_description_en.trim() || null,
      description_ar: productForm.description_ar.trim() || null, description_en: productForm.description_en.trim() || null,
      base_price: productForm.price_on_request ? null : Number(productForm.base_price),
      sale_price: productForm.price_on_request || productForm.sale_price === '' ? null : Number(productForm.sale_price),
      sale_starts_at: productForm.sale_price !== '' && productForm.sale_starts_at ? new Date(productForm.sale_starts_at).toISOString() : null,
      sale_ends_at: productForm.sale_price !== '' && productForm.sale_ends_at ? new Date(productForm.sale_ends_at).toISOString() : null,
      price_on_request: productForm.price_on_request, exclude_auto_pricing: productForm.exclude_auto_pricing,
      stock_mode: productForm.stock_mode, stock_quantity: Number(productForm.stock_quantity || 0),
      min_order_quantity: Number(productForm.min_order_quantity || 1), max_order_quantity: productForm.max_order_quantity === '' ? null : Number(productForm.max_order_quantity),
      unit_ar: productForm.unit_ar.trim() || 'قطعة', unit_en: productForm.unit_en.trim() || 'piece',
      lead_time_ar: productForm.lead_time_ar.trim() || null, lead_time_en: productForm.lead_time_en.trim() || null,
      image_url: productForm.image_url || null, gallery: productForm.gallery || [],
      tags: productForm.tags.split(',').map(x => x.trim()).filter(Boolean),
      is_active: productForm.is_active, is_featured: productForm.is_featured, visibility: productForm.visibility,
    };
    const costPayload = {
      cost_price: Number(productForm.cost_price || 0),
      target_margin_percent: productForm.target_margin_percent === '' ? null : Number(productForm.target_margin_percent),
      low_stock_threshold: Number(productForm.low_stock_threshold || 0), supplier_name: productForm.supplier_name.trim() || null,
      internal_note: productForm.internal_note.trim() || null,
    };
    const { data, error: productError } = await supabase.rpc('admin_save_product', {
      p_id: productForm.id || null, p_product: payload, p_cost: costPayload,
    });
    if (productError || !data?.id) { setError(catalogError(productError, ar)); setSaving(false); return; }
    await logAdminAction(productForm.id ? 'update_product' : 'create_product', 'product', data.id, { name_ar: data.name_ar, visibility: data.visibility, base_price: data.base_price });
    setModal(null); setNotice(ar ? 'حُفظ المنتج والتكلفة بنجاح.' : 'Product and cost saved successfully.'); notifyAdminChange('products'); await load(); setSaving(false);
  }

  async function duplicateProduct(item) {
    if (saving || loadError) return;
    setSaving(true); setError('');
    const cost = costs[item.id] || {};
    const payload = { ...item, sku: makeSku(), slug: `${item.slug || normalizeSlug(item.name_en || item.name_ar)}-${Date.now().toString(36)}`, name_ar: `${item.name_ar} — نسخة`, name_en: `${item.name_en || item.name_ar} — Copy`, visibility: 'draft', is_featured: false };
    const { data, error: copyError } = await supabase.rpc('admin_save_product', { p_id: null, p_product: payload, p_cost: { cost_price: Number(cost.cost_price || 0), target_margin_percent: cost.target_margin_percent ?? 35, low_stock_threshold: cost.low_stock_threshold ?? 3, supplier_name: cost.supplier_name || null, internal_note: cost.internal_note || null } });
    if (copyError) setError(catalogError(copyError, ar));
    else { await logAdminAction('duplicate_product', 'product', data.id, { source_product_id: item.id }); setNotice(ar ? 'أُنشئت نسخة مسودة من المنتج.' : 'A draft copy was created.'); notifyAdminChange('products'); await load(); }
    setSaving(false);
  }

  async function deleteProduct(item) {
    if (saving || !window.confirm(ar ? `حذف المنتج «${item.name_ar}» نهائيًا؟` : `Permanently delete “${item.name_en || item.name_ar}”?`)) return;
    setSaving(true); setError('');
    const { error: deleteError } = await supabase.from('products').delete().eq('id', item.id).select('id').single();
    if (deleteError) setError(catalogError(deleteError, ar));
    else { await logAdminAction('delete_product', 'product', item.id, { name_ar: item.name_ar }); notifyAdminChange('products'); await load(); }
    setSaving(false);
  }

  async function bulkUpdate(changes, action, ids = [...selected]) {
    if (!ids.length || saving || loadError) return;
    setSaving(true); setError(''); setNotice('');
    const { data, error: updateError } = await supabase.from('products').update(changes).in('id', ids).select('id');
    if (updateError || data?.length !== ids.length) setError(catalogError(updateError || { code: '42501' }, ar));
    else { await logAdminAction(`bulk_${action}`, 'product', null, { ids, changes }); setSelected(new Set()); setNotice(ar ? 'تم تحديث المنتجات وتطبيق التغيير على المتجر.' : 'Products updated and the change applied to the store.'); notifyAdminChange('products'); await load(); }
    setSaving(false);
  }

  async function saveCategory(e) {
    e.preventDefault(); setError(''); setSaving(true);
    const payload = { ...categoryForm, id: undefined, slug: normalizeSlug(categoryForm.slug || categoryForm.name_en || categoryForm.name_ar), sort_order: Number(categoryForm.sort_order || 0) };
    const req = categoryForm.id ? supabase.from('product_categories').update(payload).eq('id', categoryForm.id).select().single() : supabase.from('product_categories').insert(payload).select().single();
    const { data, error } = await req;
    if (!error) { await logAdminAction(categoryForm.id ? 'update_category' : 'create_category','product_category',data.id,{ name_ar:data.name_ar }); setModal(null); load(); }
    else setError(error.message || (ar ? 'تعذر حفظ الصنف.' : 'Could not save category.'));
    setSaving(false);
  }
  async function removeCategory(item) {
    if (!window.confirm(ar ? `حذف الصنف «${item.name_ar}»؟ المنتجات التابعة له ستبقى بدون صنف.` : `Delete category “${item.name_en || item.name_ar}”? Products will remain uncategorized.`)) return;
    const { error } = await supabase.from('product_categories').delete().eq('id', item.id);
    if (!error) { await logAdminAction('delete_category','product_category',item.id,{ name_ar:item.name_ar }); notifyAdminChange('product_categories'); load(); } else setError(catalogError(error, ar));
  }

  async function saveRule(e) {
    e.preventDefault(); setError('');
    if (!ruleForm.name_ar.trim()) { setError(ar ? 'اكتب اسم قاعدة التسعير.' : 'Enter a pricing rule name.'); return; }
    if (ruleForm.scope !== 'all' && ruleForm.scope !== 'tag' && !ruleForm.target_ids.length) { setError(ar ? 'حدد عنصرًا واحدًا على الأقل لتطبيق القاعدة.' : 'Select at least one target.'); return; }
    if (ruleForm.scope === 'tag' && !ruleForm.target_tags.trim()) { setError(ar ? 'اكتب وسمًا واحدًا على الأقل.' : 'Enter at least one tag.'); return; }
    if (ruleForm.starts_at && ruleForm.ends_at && new Date(ruleForm.ends_at) <= new Date(ruleForm.starts_at)) { setError(ar ? 'وقت النهاية يجب أن يكون بعد البداية.' : 'End time must be after start time.'); return; }
    setSaving(true);
    const payload = {
      name_ar: ruleForm.name_ar.trim(), name_en: ruleForm.name_en.trim() || null,
      badge_ar: ruleForm.badge_ar.trim() || null, badge_en: ruleForm.badge_en.trim() || null,
      scope: ruleForm.scope, target_ids: ruleForm.scope === 'category' || ruleForm.scope === 'product' ? ruleForm.target_ids : [],
      target_tags: ruleForm.scope === 'tag' ? ruleForm.target_tags.split(',').map(x => x.trim()).filter(Boolean) : [],
      rule_type: ruleForm.rule_type, value: Number(ruleForm.value || 0), priority: Number(ruleForm.priority || 100),
      starts_at: ruleForm.starts_at ? new Date(ruleForm.starts_at).toISOString() : null,
      ends_at: ruleForm.ends_at ? new Date(ruleForm.ends_at).toISOString() : null, is_active: ruleForm.is_active,
    };
    const req = ruleForm.id ? supabase.from('price_rules').update(payload).eq('id',ruleForm.id).select().single() : supabase.from('price_rules').insert(payload).select().single();
    const { data, error } = await req;
    if (!error) { await logAdminAction(ruleForm.id ? 'update_price_rule' : 'create_price_rule','price_rule',data.id,{ scope:data.scope,value:data.value,rule_type:data.rule_type }); setModal(null); load(); }
    else setError(error.message || (ar ? 'تعذر حفظ قاعدة التسعير.' : 'Could not save pricing rule.'));
    setSaving(false);
  }
  async function deleteRule(row) {
    if (!window.confirm(ar ? `حذف قاعدة «${row.name_ar}»؟` : `Delete “${row.name_en || row.name_ar}”?`)) return;
    const { error } = await supabase.from('price_rules').delete().eq('id',row.id);
    if (!error) { await logAdminAction('delete_price_rule','price_rule',row.id,{ name_ar:row.name_ar }); notifyAdminChange('price_rules'); load(); } else setError(catalogError(error, ar));
  }
  async function toggleRule(row) {
    const { error } = await supabase.from('price_rules').update({ is_active: !row.is_active }).eq('id',row.id);
    if (!error) { notifyAdminChange('price_rules'); load(); } else setError(catalogError(error, ar));
  }

  const selectedAll = filteredProducts.length > 0 && filteredProducts.every(p => selected.has(p.id));
  const toggleAll = () => setSelected(selectedAll ? new Set() : new Set(filteredProducts.map(p => p.id)));
  const affectedByRule = useMemo(() => products.filter(p => ruleMatches({ ...ruleForm, target_tags: ruleForm.target_tags.split(',').map(x=>x.trim()).filter(Boolean) }, p)), [products, ruleForm]);

  return <div className="admin-page">
    <div className="admin-page-head"><div><span>{ar ? 'التجارة الذكية' : 'SMART COMMERCE'}</span><h2>{ar ? 'استوديو المنتجات والتسعير' : 'Product & pricing studio'}</h2><p>{ar ? 'أدر المنتج مرة واحدة: التكلفة، سعر البيع، الصور، المخزون، ثم شغّل مواسم وعروض على مجموعات كاملة بدون تعديل كل منتج.' : 'Manage each product once—cost, selling price, media and inventory—then launch seasonal pricing across groups without editing every item.'}</p></div><div className="admin-head-actions"><button className="admin-secondary-button" onClick={load}><RefreshCw className={loading ? 'spin' : ''} size={16}/>{ar ? 'تحديث' : 'Refresh'}</button><button className="admin-primary-button" disabled={saving || !!loadError} onClick={() => tab === 'products' ? openProduct() : tab === 'categories' ? openCategory() : openRule()}><Plus size={17}/>{tab === 'products' ? (ar ? 'إضافة منتج' : 'Add product') : tab === 'categories' ? (ar ? 'إضافة صنف' : 'Add category') : (ar ? 'قاعدة تسعير' : 'Pricing rule')}</button></div></div>

    {loadError && <div className="admin-feedback error" role="alert">{loadError}</div>}
    {!modal && error && <div className="admin-feedback error" role="alert">{error}</div>}
    {notice && <div className="admin-feedback success" role="status">{notice}</div>}
    <AdminStoreStatus lang={lang} published={loadError ? null : metrics.public}/>
    <div className="catalog-metric-grid">
      <Metric icon={Eye} value={metrics.public} label={ar ? 'منتج ظاهر' : 'Public products'}/>
      <Metric icon={Sparkles} value={metrics.featured} label={ar ? 'منتجات مميزة' : 'Featured'}/>
      <Metric icon={TrendingUp} value={`${metrics.avgMargin.toFixed(1)}%`} label={ar ? 'متوسط الهامش' : 'Avg margin'}/>
      <Metric icon={PackagePlus} value={metrics.low} label={ar ? 'مخزون منخفض' : 'Low stock'}/>
    </div>

    <div className="admin-segmented-tabs catalog-tabs">
      <button className={tab === 'products' ? 'active' : ''} onClick={() => {setTab('products');setQuery('');}}><Boxes size={16}/>{ar ? 'المنتجات' : 'Products'}<em>{products.length}</em></button>
      <button className={tab === 'categories' ? 'active' : ''} onClick={() => {setTab('categories');setQuery('');}}><FolderPlus size={16}/>{ar ? 'الأصناف' : 'Categories'}<em>{categories.length}</em></button>
      <button className={tab === 'pricing' ? 'active' : ''} onClick={() => {setTab('pricing');setQuery('');}}><WandSparkles size={16}/>{ar ? 'التسعير الموسمي' : 'Smart pricing'}<em>{rules.length}</em></button>
    </div>

    {tab === 'pricing' && <section className="pricing-shortcuts">
      <div className="pricing-shortcut-copy"><span><WandSparkles size={16}/>{ar ? 'اختصارات الموسم' : 'SEASON SHORTCUTS'}</span><h3>{ar ? 'عرض على المتجر كله في أقل من دقيقة' : 'Launch a store-wide campaign in under a minute'}</h3><p>{ar ? 'هذه القواعد لا تغيّر سعر المنتج الأصلي. عند انتهاء الموسم يرجع السعر تلقائيًا.' : 'Rules never overwrite regular product prices. When the campaign ends, pricing returns automatically.'}</p></div>
      <div className="pricing-shortcut-actions">{[10,15,20,25].map(percent => <button key={percent} onClick={() => openRule(null,{ name_ar:`عرض موسمي ${percent}%`, name_en:`Seasonal ${percent}%`, badge_ar:'عرض موسمي', badge_en:'Seasonal offer', scope:'all', rule_type:'percent', value:percent, priority:100 })}><Percent size={17}/><b>{percent}%</b><span>{ar ? 'كل المتجر' : 'Whole store'}</span></button>)}</div>
    </section>}

    <section className="admin-panel admin-table-shell">
      <div className="admin-toolbar"><div className="admin-search-field"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={tab === 'products' ? (ar ? 'ابحث بالاسم أو SKU أو الوسم…' : 'Search name, SKU or tag…') : tab === 'categories' ? (ar ? 'ابحث في الأصناف…' : 'Search categories…') : (ar ? 'ابحث في قواعد التسعير…' : 'Search pricing rules…')}/>{query && <button onClick={() => setQuery('')}><X size={15}/></button>}</div></div>

      {tab === 'products' && <>
        <div className="catalog-filters">{[['all', 'كل المنتجات', 'All products'], ['published', 'منشورة', 'Published'], ['draft', 'مسودات', 'Drafts'], ['out-of-stock', 'نفد المخزون', 'Out of stock'], ['missing-images', 'بدون صورة', 'No photo']].map(([key, arabic, english]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => { setFilter(key); const params = new URLSearchParams(location.search); if (key === 'all') params.delete('filter'); else params.set('filter', key); navigate({ pathname: '/admin/catalog', search: params.toString() ? `?${params}` : '' }, { replace: true }); }}>{ar ? arabic : english}</button>)}</div>
        {selected.size > 0 && <div className="catalog-bulk-bar"><div><CheckSquare2 size={17}/><strong>{ar ? `${selected.size} محدد` : `${selected.size} selected`}</strong></div><div><button onClick={() => bulkUpdate({visibility:'public',is_active:true},'publish')}><Eye size={15}/>{ar ? 'نشر' : 'Publish'}</button><button onClick={() => bulkUpdate({visibility:'draft'},'draft')}><EyeOff size={15}/>{ar ? 'مسودة' : 'Draft'}</button><button onClick={() => bulkUpdate({is_featured:true},'feature')}><Sparkles size={15}/>{ar ? 'تمييز' : 'Feature'}</button><button onClick={() => bulkUpdate({is_featured:false},'unfeature')}><X size={15}/>{ar ? 'إلغاء التمييز' : 'Unfeature'}</button></div></div>}
        <div className="admin-table-responsive"><table className="admin-table smart-product-table"><thead><tr><th className="catalog-check"><input type="checkbox" checked={selectedAll} onChange={toggleAll}/></th><th>{ar ? 'المنتج' : 'Product'}</th><th>{ar ? 'التكلفة' : 'Cost'}</th><th>{ar ? 'سعر البيع' : 'Selling'}</th><th>{ar ? 'الربح / الهامش' : 'Profit / margin'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th>{ar ? 'المخزون' : 'Stock'}</th><th/></tr></thead><tbody>{filteredProducts.map(item => {
          const cost = Number(costs[item.id]?.cost_price || 0); const sell = currentPrice(item,rules); const profit = sell === null ? null : sell-cost; const margin = sell > 0 ? (profit/sell)*100 : 0;
          return <tr key={item.id}><td className="catalog-check"><input type="checkbox" checked={selected.has(item.id)} onChange={() => setSelected(cur => { const n=new Set(cur); n.has(item.id)?n.delete(item.id):n.add(item.id); return n; })}/></td><td><div className="admin-product-cell"><span className="admin-product-thumb">{item.image_url ? <img src={item.image_url} alt=""/> : <PackagePlus size={19}/>}</span><div><strong>{item.name_ar}</strong><small>{item.name_en}</small><span className="product-code">{item.sku || '—'}</span>{item.is_featured && <em>{ar ? 'مميز' : 'Featured'}</em>}</div></div></td><td><strong>{money(cost,lang)}</strong>{cost === 0 && <small className="catalog-muted">{ar ? 'لم تسجل' : 'Not set'}</small>}</td><td>{item.price_on_request ? <span className="admin-chip">{ar ? 'حسب الطلب' : 'On request'}</span> : <div className="admin-text-stack"><strong>{money(sell,lang)}</strong>{Number(item.base_price) !== Number(sell) && <small className="strike">{money(item.base_price,lang)}</small>}</div>}</td><td>{sell === null ? '—' : <div className={`profit-stack ${profit < 0 ? 'loss' : ''}`}><strong>{money(profit,lang)}</strong><small>{margin.toFixed(1)}%</small></div>}</td><td><div className="catalog-status-stack"><span className={`admin-visibility ${item.visibility}`}>{item.visibility === 'public' ? (ar ? 'عام' : 'Public') : item.visibility === 'private' ? (ar ? 'خاص' : 'Private') : (ar ? 'مسودة' : 'Draft')}</span>{!item.is_active && <small>{ar ? 'متوقف' : 'Inactive'}</small>}</div></td><td>{item.stock_mode === 'tracked' ? <span className={Number(item.stock_quantity)<=Number(costs[item.id]?.low_stock_threshold||0)?'stock-low':''}>{item.stock_quantity}</span> : item.stock_mode === 'unlimited' ? (ar ? 'غير محدود' : 'Unlimited') : (ar ? 'حسب الطلب' : 'Made to order')}</td><td><div className="catalog-row-actions">{item.is_active && item.visibility === 'public' && <Link to={`/store/${item.slug || item.id}`} target="_blank" rel="noreferrer" title={ar ? 'معاينة المنتج' : 'Preview product'}><Eye size={16}/></Link>}<button disabled={saving} onClick={() => bulkUpdate(item.visibility === 'public' && item.is_active ? { visibility: 'draft' } : { visibility: 'public', is_active: true }, 'visibility', [item.id])} title={item.visibility === 'public' && item.is_active ? (ar ? 'إلغاء النشر' : 'Unpublish') : (ar ? 'نشر المنتج' : 'Publish product')}>{item.visibility === 'public' && item.is_active ? <EyeOff size={16}/> : <Eye size={16}/>}</button><button onClick={() => openProduct(item)} title={ar ? 'تعديل' : 'Edit'}><Edit3 size={16}/></button><button onClick={() => duplicateProduct(item)} title={ar ? 'نسخ المنتج' : 'Duplicate'}><Copy size={16}/></button><button className="danger" onClick={() => deleteProduct(item)} title={ar ? 'حذف' : 'Delete'}><Trash2 size={16}/></button></div></td></tr>;
        })}</tbody></table></div>
      </>}

      {tab === 'categories' && <div className="admin-category-grid">{filteredCategories.map(item => <article className="admin-category-card" key={item.id}><div className="admin-category-icon">{item.image_url ? <img src={item.image_url} alt=""/> : <Boxes size={22}/>}</div><div><small>/{item.slug}</small><h3>{item.name_ar}</h3><p>{item.description_ar || (ar ? 'بدون وصف' : 'No description')}</p><span className={item.is_active ? 'on' : 'off'}>{item.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'مخفي' : 'Hidden')}</span></div><div className="admin-category-actions"><button onClick={() => openCategory(item)}><Edit3 size={16}/></button><button className="danger" onClick={() => removeCategory(item)}><Trash2 size={16}/></button></div></article>)}</div>}

      {tab === 'pricing' && <div className="smart-rule-grid">{filteredRules.map(row => <article className={`smart-rule-card ${activeNow(row)?'live':''}`} key={row.id}><div className="smart-rule-top"><span className="smart-rule-icon"><BadgePercent size={20}/></span><div><small>{row.scope === 'all' ? (ar ? 'كل المتجر' : 'Whole store') : row.scope === 'category' ? (ar ? 'أصناف' : 'Categories') : row.scope === 'product' ? (ar ? 'منتجات محددة' : 'Products') : (ar ? 'حسب الوسم' : 'By tag')}</small><h3>{ar ? row.name_ar : (row.name_en || row.name_ar)}</h3></div><button className={`admin-switch ${row.is_active?'on':''}`} onClick={() => toggleRule(row)}><i/></button></div><div className="smart-rule-value">{row.rule_type === 'percent' ? <><b>{Number(row.value).toFixed(0)}%</b><span>{ar ? 'خصم' : 'OFF'}</span></> : row.rule_type === 'fixed' ? <><b>{money(row.value,lang)}</b><span>{ar ? 'خصم ثابت' : 'FIXED OFF'}</span></> : <><b>{money(row.value,lang)}</b><span>{ar ? 'سعر نهائي' : 'FIXED PRICE'}</span></>}</div><div className="smart-rule-meta"><span>{dateOnly(row.starts_at,lang)} → {dateOnly(row.ends_at,lang)}</span><span>{ar ? `أولوية ${row.priority}` : `Priority ${row.priority}`}</span></div><footer><span className={activeNow(row)?'live':'idle'}>{activeNow(row)?(ar?'يعمل الآن':'Live now'):(row.is_active?(ar?'مجدول/بانتظار':'Scheduled / waiting'):(ar?'متوقف':'Inactive'))}</span><div><button onClick={() => openRule(row)}><Edit3 size={16}/></button><button className="danger" onClick={() => deleteRule(row)}><Trash2 size={16}/></button></div></footer></article>)}</div>}

      {!loading && ((tab==='products'&&!filteredProducts.length)||(tab==='categories'&&!filteredCategories.length)||(tab==='pricing'&&!filteredRules.length)) && <div className="admin-empty-state"><Boxes size={29}/><strong>{tab==='products'?(ar?'ابدأ بأول منتج':'Create your first product'):tab==='categories'?(ar?'ابدأ بأول صنف':'Create your first category'):(ar?'لا توجد قواعد تسعير':'No pricing rules yet')}</strong><p>{ar ? 'كل البنية جاهزة. أضف المحتوى عندما تكون مستعدًا.' : 'Everything is ready. Add content whenever you are ready.'}</p></div>}
    </section>

    {modal === 'product' && <Modal busy={saving} wide title={productForm.id ? (ar ? 'تعديل المنتج' : 'Edit product') : (ar ? 'إضافة منتج' : 'Add product')} onClose={() => setModal(null)}><form className="admin-modal-form product-studio-form" onSubmit={saveProduct}>{error && <div className="admin-form-error">{error}</div>}
      <StudioSection icon={Layers3} title={ar?'هوية المنتج':'Product identity'} hint={ar?'الاسم باللغتين والبيانات التي تظهر للعميل.':'Bilingual customer-facing identity.'}>
        <div className="admin-form-grid two"><label>{ar ? 'اسم المنتج بالعربية' : 'Arabic product name'}<input required value={productForm.name_ar} onChange={e=>setProductForm(v=>({...v,name_ar:e.target.value}))}/></label><label>{ar ? 'اسم المنتج بالإنجليزية' : 'English product name'}<input required dir="ltr" value={productForm.name_en} onChange={e=>setProductForm(v=>({...v,name_en:e.target.value}))}/></label><label>{ar?'الصنف':'Category'}<select value={productForm.category_id} onChange={e=>setProductForm(v=>({...v,category_id:e.target.value}))}><option value="">{ar?'بدون صنف':'No category'}</option>{categories.map(c=><option key={c.id} value={c.id}>{ar?c.name_ar:(c.name_en||c.name_ar)}</option>)}</select></label><label>SKU<input dir="ltr" value={productForm.sku} onChange={e=>setProductForm(v=>({...v,sku:e.target.value}))}/></label><label>{ar?'رابط المنتج المختصر':'Product slug'}<input dir="ltr" value={productForm.slug} onChange={e=>setProductForm(v=>({...v,slug:e.target.value}))} placeholder="premium-white-roses"/></label><label>{ar?'حالة الظهور':'Visibility'}<select value={productForm.visibility} onChange={e=>setProductForm(v=>({...v,visibility:e.target.value}))}><option value="draft">{ar?'مسودة':'Draft'}</option><option value="public">{ar?'عام في المتجر':'Public in store'}</option><option value="private">{ar?'خاص':'Private'}</option></select></label></div>
      </StudioSection>

      <StudioSection icon={Tags} title={ar?'الوصف والتفاصيل':'Descriptions & details'} hint={ar?'وصف قصير للبطاقة ووصف كامل لصفحة المنتج.':'Short card copy plus full product detail copy.'}>
        <div className="admin-form-grid two"><label>{ar?'وصف قصير بالعربية':'Arabic short description'}<textarea rows="2" value={productForm.short_description_ar} onChange={e=>setProductForm(v=>({...v,short_description_ar:e.target.value}))}/></label><label>{ar?'وصف قصير بالإنجليزية':'English short description'}<textarea rows="2" dir="ltr" value={productForm.short_description_en} onChange={e=>setProductForm(v=>({...v,short_description_en:e.target.value}))}/></label><label>{ar?'التفاصيل بالعربية':'Arabic full details'}<textarea rows="5" value={productForm.description_ar} onChange={e=>setProductForm(v=>({...v,description_ar:e.target.value}))}/></label><label>{ar?'التفاصيل بالإنجليزية':'English full details'}<textarea rows="5" dir="ltr" value={productForm.description_en} onChange={e=>setProductForm(v=>({...v,description_en:e.target.value}))}/></label></div>
      </StudioSection>

      <StudioSection icon={Calculator} title={ar?'طريقة تسعير المنتج':'Product pricing method'} hint={ar?'يناسب الشجر والورد والمراكن وكل منتجاتك. اختر لكل منتج طريقة البيع المناسبة.':'Suitable for trees, flowers, planters and all products. Choose pricing for each product.'}>
        <div className="admin-pricing-choice">{[[false,'سعر محدد','Fixed price','أدخل سعر البيع ويكمل العميل الشراء من السلة.','Enter a selling price so customers can checkout.'],[true,'طلب عرض سعر','Request a quotation','بدون سعر ثابت. يرسل العميل الكمية والتفاصيل وترد عليه الإدارة بالسعر.','No fixed price. Customers send quantities and details; administration quotes.']].map(([mode,a,en,da,de])=><button type="button" aria-pressed={productForm.price_on_request===mode} className={productForm.price_on_request===mode?'selected':''} key={String(mode)} onClick={()=>setProductForm(v=>({...v,price_on_request:mode,...(mode?{base_price:'',sale_price:'',sale_starts_at:'',sale_ends_at:''}:{})}))}><strong>{ar?a:en}</strong><small>{ar?da:de}</small></button>)}</div>
      </StudioSection>

      <StudioSection icon={Calculator} title={ar?'التكلفة والربحية':'Cost & profitability'} hint={ar?'رأس المال خاص بالإدارة فقط ولا يظهر للعميل أبدًا.':'Cost data is admin-only and never exposed to customers.'}>
        <div className="profit-studio"><div className="admin-form-grid three"><label>{ar?'رأس المال / التكلفة':'Cost price'}<input type="number" min="0" step="0.01" value={productForm.cost_price} onChange={e=>setProductForm(v=>({...v,cost_price:e.target.value}))}/></label><label>{ar?'سعر البيع الأساسي':'Regular selling price'}<input type="number" min="0" step="0.01" value={productForm.base_price} onChange={e=>setProductForm(v=>({...v,base_price:e.target.value}))} disabled={productForm.price_on_request}/></label><label>{ar?'الهامش المستهدف %':'Target margin %'}<input type="number" min="0" max="95" step="0.1" value={productForm.target_margin_percent} onChange={e=>setProductForm(v=>({...v,target_margin_percent:e.target.value}))}/></label></div>{!productForm.price_on_request&&<div className="profit-preview"><div><span>{ar?'الربح الحالي':'Current profit'}</span><b>{money(previewProfit,lang)}</b></div><div><span>{ar?'هامش الربح':'Margin'}</span><b>{previewMargin.toFixed(1)}%</b></div><div><span>{ar?'سعر مقترح للهامش':'Suggested price'}</span><b>{money(suggestedPrice,lang)}</b>{suggestedPrice>0&&<button type="button" onClick={()=>setProductForm(v=>({...v,base_price:suggestedPrice.toFixed(2)}))}>{ar?'استخدمه':'Use'}</button>}</div></div>}</div>
        {!productForm.price_on_request&&<div className="manual-sale-box"><div className="manual-sale-head"><BadgePercent size={18}/><div><strong>{ar?'عرض خاص لهذا المنتج فقط':'Special sale for this product only'}</strong><small>{ar?'له أولوية على عروض الموسم العامة.':'Takes priority over store-wide seasonal pricing.'}</small></div></div><div className="admin-form-grid three"><label>{ar?'سعر العرض الخاص':'Special sale price'}<input type="number" min="0" step="0.01" value={productForm.sale_price} onChange={e=>setProductForm(v=>({...v,sale_price:e.target.value}))} disabled={productForm.price_on_request}/></label><label>{ar?'يبدأ':'Starts'}<input type="datetime-local" value={productForm.sale_starts_at} onChange={e=>setProductForm(v=>({...v,sale_starts_at:e.target.value}))}/></label><label>{ar?'ينتهي':'Ends'}<input type="datetime-local" value={productForm.sale_ends_at} onChange={e=>setProductForm(v=>({...v,sale_ends_at:e.target.value}))}/></label></div></div>}
      </StudioSection>

      <StudioSection icon={ImagePlus} title={ar?'الصور':'Media'} hint={ar?'ارفع الصور مباشرة. لا حاجة لأي روابط خارجية.':'Upload directly—no external image links needed.'}>
        <AdminMediaUpload lang={lang} folder="products/cover" value={productForm.image_url} onChange={value=>setProductForm(v=>({...v,image_url:value}))} label={ar?'الصورة الرئيسية':'Cover image'}/>
        <AdminGalleryUpload lang={lang} folder="products/gallery" value={productForm.gallery} onChange={gallery=>setProductForm(v=>({...v,gallery}))} label={ar?'صور تفاصيل المنتج':'Product gallery'}/>
      </StudioSection>

      <StudioSection icon={PackagePlus} title={ar?'المخزون والطلب':'Inventory & ordering'} hint={ar?'حدد طريقة البيع والحدود والتنبيه المبكر للمخزون.':'Control stock, quantity limits and low-stock alerts.'}>
        <div className="admin-form-grid three"><label>{ar?'إدارة المخزون':'Stock mode'}<select value={productForm.stock_mode} onChange={e=>setProductForm(v=>({...v,stock_mode:e.target.value}))}><option value="made_to_order">{ar?'حسب الطلب':'Made to order'}</option><option value="unlimited">{ar?'غير محدود':'Unlimited'}</option><option value="tracked">{ar?'تتبع الكمية':'Track quantity'}</option></select></label><label>{ar?'الكمية الحالية':'Current quantity'}<input type="number" min="0" step="1" value={productForm.stock_quantity} onChange={e=>setProductForm(v=>({...v,stock_quantity:e.target.value}))} disabled={productForm.stock_mode!=='tracked'}/></label><label>{ar?'تنبيه مخزون منخفض عند':'Low-stock threshold'}<input type="number" min="0" step="1" value={productForm.low_stock_threshold} onChange={e=>setProductForm(v=>({...v,low_stock_threshold:e.target.value}))} disabled={productForm.stock_mode!=='tracked'}/></label><label>{ar?'أقل كمية للطلب':'Minimum order'}<input type="number" min="0.01" step="0.01" value={productForm.min_order_quantity} onChange={e=>setProductForm(v=>({...v,min_order_quantity:e.target.value}))}/></label><label>{ar?'أقصى كمية للطلب':'Maximum order'}<input type="number" min="0.01" step="0.01" value={productForm.max_order_quantity} onChange={e=>setProductForm(v=>({...v,max_order_quantity:e.target.value}))} placeholder={ar?'بدون حد':'No limit'}/></label><label>{ar?'اسم المورد — داخلي':'Supplier — internal'}<input value={productForm.supplier_name} onChange={e=>setProductForm(v=>({...v,supplier_name:e.target.value}))}/></label><label>{ar?'وحدة البيع بالعربية':'Arabic unit'}<input value={productForm.unit_ar} onChange={e=>setProductForm(v=>({...v,unit_ar:e.target.value}))}/></label><label>{ar?'وحدة البيع بالإنجليزية':'English unit'}<input dir="ltr" value={productForm.unit_en} onChange={e=>setProductForm(v=>({...v,unit_en:e.target.value}))}/></label><label>{ar?'مدة التجهيز بالعربية':'Arabic lead time'}<input value={productForm.lead_time_ar} onChange={e=>setProductForm(v=>({...v,lead_time_ar:e.target.value}))} placeholder="خلال 24–48 ساعة"/></label><label>{ar?'مدة التجهيز بالإنجليزية':'English lead time'}<input dir="ltr" value={productForm.lead_time_en} onChange={e=>setProductForm(v=>({...v,lead_time_en:e.target.value}))} placeholder="Within 24–48 hours"/></label></div>
      </StudioSection>

      <StudioSection icon={Sparkles} title={ar?'التحكم الذكي':'Smart controls'} hint={ar?'الوسوم تساعدك في تشغيل عروض جماعية مثل: فنادق، رمضان، ورد أبيض.':'Tags let you target bulk campaigns such as hotels, Ramadan or white flowers.'}>
        <label>{ar?'الوسوم — افصل بفاصلة':'Tags — comma separated'}<input value={productForm.tags} onChange={e=>setProductForm(v=>({...v,tags:e.target.value}))} placeholder={ar?'فنادق، رمضان، ورد أبيض':'hotels, ramadan, white-flowers'}/></label><label>{ar?'ملاحظة داخلية للإدارة':'Internal admin note'}<textarea rows="3" value={productForm.internal_note} onChange={e=>setProductForm(v=>({...v,internal_note:e.target.value}))}/></label><div className="admin-toggle-row"><Toggle label={ar?'منتج مميز':'Featured product'} checked={productForm.is_featured} onChange={()=>setProductForm(v=>({...v,is_featured:!v.is_featured}))}/><Toggle label={ar?'نشط':'Active'} checked={productForm.is_active} onChange={()=>setProductForm(v=>({...v,is_active:!v.is_active}))}/><Toggle label={ar?'استثناء من العروض العامة':'Exclude from auto campaigns'} checked={productForm.exclude_auto_pricing} onChange={()=>setProductForm(v=>({...v,exclude_auto_pricing:!v.exclude_auto_pricing}))}/></div>
      </StudioSection>

      <div className="admin-modal-actions sticky"><button type="button" className="admin-secondary-button" onClick={()=>setModal(null)}>{ar?'إلغاء':'Cancel'}</button><button className="admin-primary-button" disabled={saving}><Check size={16}/>{saving?(ar?'جاري الحفظ…':'Saving…'):(ar?'حفظ المنتج':'Save product')}</button></div>
    </form></Modal>}

    {modal === 'category' && <Modal busy={saving} title={categoryForm.id?(ar?'تعديل الصنف':'Edit category'):(ar?'إضافة صنف':'Add category')} onClose={()=>setModal(null)}><form className="admin-modal-form" onSubmit={saveCategory}>{error&&<div className="admin-form-error">{error}</div>}<div className="admin-form-grid two"><label>{ar?'اسم الصنف بالعربية':'Arabic category name'}<input required value={categoryForm.name_ar} onChange={e=>setCategoryForm(v=>({...v,name_ar:e.target.value}))}/></label><label>{ar?'الاسم بالإنجليزية':'English name'}<input required dir="ltr" value={categoryForm.name_en} onChange={e=>setCategoryForm(v=>({...v,name_en:e.target.value}))}/></label></div><label>Slug<input required dir="ltr" value={categoryForm.slug} onChange={e=>setCategoryForm(v=>({...v,slug:e.target.value}))} placeholder="hotel-flowers"/></label><div className="admin-form-grid two"><label>{ar?'الوصف بالعربية':'Arabic description'}<textarea rows="4" value={categoryForm.description_ar} onChange={e=>setCategoryForm(v=>({...v,description_ar:e.target.value}))}/></label><label>{ar?'الوصف بالإنجليزية':'English description'}<textarea rows="4" dir="ltr" value={categoryForm.description_en||''} onChange={e=>setCategoryForm(v=>({...v,description_en:e.target.value}))}/></label></div><label>{ar?'ترتيب الظهور':'Sort order'}<input type="number" value={categoryForm.sort_order} onChange={e=>setCategoryForm(v=>({...v,sort_order:e.target.value}))}/></label><AdminMediaUpload lang={lang} folder="categories" value={categoryForm.image_url||''} onChange={value=>setCategoryForm(v=>({...v,image_url:value}))} label={ar?'صورة الصنف':'Category image'}/><Toggle label={ar?'الصنف نشط':'Category active'} checked={categoryForm.is_active} onChange={()=>setCategoryForm(v=>({...v,is_active:!v.is_active}))}/><div className="admin-modal-actions"><button type="button" className="admin-secondary-button" onClick={()=>setModal(null)}>{ar?'إلغاء':'Cancel'}</button><button className="admin-primary-button" disabled={saving}><Check size={16}/>{ar?'حفظ الصنف':'Save category'}</button></div></form></Modal>}

    {modal === 'rule' && <Modal busy={saving} wide title={ruleForm.id?(ar?'تعديل قاعدة التسعير':'Edit pricing rule'):(ar?'قاعدة تسعير ذكية':'Smart pricing rule')} onClose={()=>setModal(null)}><form className="admin-modal-form" onSubmit={saveRule}>{error&&<div className="admin-form-error">{error}</div>}
      <div className="pricing-rule-preview"><div><WandSparkles size={22}/><span>{ar?'سيؤثر على':'Will affect'}</span><strong>{affectedByRule.length}</strong><span>{ar?'منتج':'products'}</span></div><p>{ar?'قاعدة التسعير لا تغيّر السعر الأساسي في قاعدة البيانات؛ هي طبقة موسمية تلقائية وآمنة.':'Pricing rules never overwrite the regular database price; they are an automatic campaign layer.'}</p></div>
      <div className="admin-form-grid two"><label>{ar?'اسم القاعدة بالعربية':'Arabic rule name'}<input required value={ruleForm.name_ar} onChange={e=>setRuleForm(v=>({...v,name_ar:e.target.value}))}/></label><label>{ar?'الاسم بالإنجليزية':'English rule name'}<input dir="ltr" value={ruleForm.name_en} onChange={e=>setRuleForm(v=>({...v,name_en:e.target.value}))}/></label><label>{ar?'شارة العرض بالعربية':'Arabic badge'}<input value={ruleForm.badge_ar} onChange={e=>setRuleForm(v=>({...v,badge_ar:e.target.value}))} placeholder="عرض رمضان"/></label><label>{ar?'شارة العرض بالإنجليزية':'English badge'}<input dir="ltr" value={ruleForm.badge_en} onChange={e=>setRuleForm(v=>({...v,badge_en:e.target.value}))} placeholder="Ramadan offer"/></label></div>
      <div className="admin-form-grid three"><label>{ar?'النطاق':'Scope'}<select value={ruleForm.scope} onChange={e=>setRuleForm(v=>({...v,scope:e.target.value,target_ids:[]}))}><option value="all">{ar?'كل المتجر':'Whole store'}</option><option value="category">{ar?'أصناف محددة':'Selected categories'}</option><option value="product">{ar?'منتجات محددة':'Selected products'}</option><option value="tag">{ar?'حسب الوسم':'By tag'}</option></select></label><label>{ar?'نوع التخفيض':'Pricing action'}<select value={ruleForm.rule_type} onChange={e=>setRuleForm(v=>({...v,rule_type:e.target.value}))}><option value="percent">{ar?'خصم بالنسبة %':'Percentage off'}</option><option value="fixed">{ar?'خصم مبلغ ثابت':'Fixed amount off'}</option><option value="fixed_price">{ar?'سعر نهائي ثابت':'Fixed final price'}</option></select></label><label>{ar?'القيمة':'Value'}<input type="number" min="0" step="0.01" value={ruleForm.value} onChange={e=>setRuleForm(v=>({...v,value:e.target.value}))}/></label></div>
      {ruleForm.scope==='category'&&<TargetSelect label={ar?'اختر الأصناف':'Select categories'} rows={categories.map(c=>({id:c.id,label:ar?c.name_ar:(c.name_en||c.name_ar)}))} value={ruleForm.target_ids} onChange={target_ids=>setRuleForm(v=>({...v,target_ids}))}/>}
      {ruleForm.scope==='product'&&<TargetSelect label={ar?'اختر المنتجات':'Select products'} rows={products.map(p=>({id:p.id,label:`${ar?p.name_ar:(p.name_en||p.name_ar)} · ${p.sku||''}`}))} value={ruleForm.target_ids} onChange={target_ids=>setRuleForm(v=>({...v,target_ids}))}/>}
      {ruleForm.scope==='tag'&&<label>{ar?'الوسوم المستهدفة':'Target tags'}<input value={ruleForm.target_tags} onChange={e=>setRuleForm(v=>({...v,target_tags:e.target.value}))} placeholder={ar?'رمضان، فنادق':'ramadan, hotels'}/></label>}
      <div className="admin-form-grid three"><label>{ar?'يبدأ':'Starts'}<input type="datetime-local" value={ruleForm.starts_at} onChange={e=>setRuleForm(v=>({...v,starts_at:e.target.value}))}/></label><label>{ar?'ينتهي':'Ends'}<input type="datetime-local" value={ruleForm.ends_at} onChange={e=>setRuleForm(v=>({...v,ends_at:e.target.value}))}/></label><label>{ar?'الأولوية':'Priority'}<input type="number" min="0" step="1" value={ruleForm.priority} onChange={e=>setRuleForm(v=>({...v,priority:e.target.value}))}/><small className="admin-field-hint">{ar?'عند تعارض قاعدتين، الأعلى أولوية يعمل.':'Higher priority wins when rules overlap.'}</small></label></div>
      <Toggle label={ar?'تفعيل القاعدة':'Rule active'} checked={ruleForm.is_active} onChange={()=>setRuleForm(v=>({...v,is_active:!v.is_active}))}/><div className="admin-modal-actions"><button type="button" className="admin-secondary-button" onClick={()=>setModal(null)}>{ar?'إلغاء':'Cancel'}</button><button className="admin-primary-button" disabled={saving}><Check size={16}/>{saving?(ar?'جاري الحفظ…':'Saving…'):(ar?'حفظ قاعدة التسعير':'Save pricing rule')}</button></div>
    </form></Modal>}
  </div>;
}

function Metric({ icon: Icon, value, label }) { return <article className="catalog-metric"><span><Icon size={18}/></span><div><strong>{value}</strong><small>{label}</small></div></article>; }
function StudioSection({ icon: Icon, title, hint, children }) { return <section className="product-studio-section"><header><span><Icon size={18}/></span><div><h4>{title}</h4><p>{hint}</p></div></header><div className="product-studio-body">{children}</div></section>; }
function TargetSelect({ label, rows, value, onChange }) { return <label>{label}<select multiple size="7" value={value} onChange={e=>onChange(Array.from(e.target.selectedOptions).map(o=>o.value))}>{rows.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select><small className="admin-field-hint">Ctrl / Command + click</small></label>; }
function Modal({ title, onClose, children, wide=false, busy=false }) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = event => { if (event.key === 'Escape' && !busy) closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [busy]);
  return <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}><div className={`admin-modal ${wide ? 'wide product-studio-modal' : ''}`}><div className="admin-modal-head"><div><small>BALQEES COMMERCE STUDIO</small><h3>{title}</h3></div><button type="button" disabled={busy} onClick={onClose} aria-label="إغلاق / Close"><X size={19}/></button></div>{children}</div></div>;
}
function Toggle({ label, checked, onChange }) { return <button type="button" className="admin-toggle-option" onClick={onChange}><span>{label}</span><span className={`admin-switch ${checked?'on':''}`}><i/></span></button>; }
