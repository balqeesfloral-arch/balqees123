import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpLeft, Boxes, CircleAlert, ClipboardPlus, Clock3, Globe2, MessageSquareText, PackageSearch, Plus, RefreshCw, Sparkles, UsersRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { dateTime, money } from '../adminUtils';
import { ADMIN_GROUPS, ADMIN_NAV } from '../adminNavigation';
import AdminStoreStatus from '../AdminStoreStatus';
import useAdminLiveRefresh from '../useAdminLiveRefresh';

const WATCHED = ['products', 'product_categories', 'orders', 'customer_profiles', 'organization_service_requests', 'support_conversations', 'notifications','quote_requests'];
const STATUS = {
  under_review: ['قيد المراجعة', 'Under review'], approved: ['معتمد', 'Approved'], in_progress: ['قيد التجهيز', 'Preparing'], ready: ['جاهز للتسليم', 'Ready'], out_for_delivery: ['في الطريق', 'Out for delivery'], quoted: ['تمت مراجعة التسعير', 'Pricing reviewed'], delivery_failed_payment: ['تعثر السداد', 'Payment issue'], pending: ['بانتظار المراجعة', 'Pending'], confirmed: ['مؤكد', 'Confirmed'], processing: ['قيد التجهيز', 'Processing'],
  preparing: ['قيد التجهيز', 'Preparing'], shipped: ['في الطريق', 'Shipped'], delivered: ['تم التسليم', 'Delivered'],
  completed: ['مكتمل', 'Completed'], cancelled: ['ملغي', 'Cancelled'], open: ['مفتوح', 'Open'],
  submitted: ['مرسل', 'Submitted'], closed: ['مغلق', 'Closed'], resolved: ['تم الحل', 'Resolved'],
};
const statusLabel = (value, ar) => STATUS[value]?.[ar ? 0 : 1] || value || '—';
const formatCount = (value, ar) => value === null || value === undefined ? '—' : Number(value).toLocaleString(ar ? 'ar-SA' : 'en-US');

export default function AdminDashboard({ lang, onRefreshBadges }) {
  const ar = lang === 'ar';
  const [snapshot, setSnapshot] = useState({});
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    const count = table => supabase.from(table).select('id', { count: 'exact', head: true });
    const jobs = [
      ['users', count('customer_profiles'), true],
      ['orders', count('orders'), true],
      ['products', count('products'), true],
      ['published', count('products').eq('is_active', true).eq('visibility', 'public'), true],
      ['drafts', count('products').eq('visibility', 'draft'), true],
      ['outOfStock', count('products').eq('stock_mode', 'tracked').lte('stock_quantity', 0).eq('is_active', true), true],
      ['missingImages', count('products').is('image_url', null).eq('is_active', true).eq('visibility', 'public'), true],
      ['categories', count('product_categories').eq('is_active', true), true],
      ['support', count('support_conversations').in('status', ['open', 'pending']), true],
      ['requests', count('organization_service_requests').eq('status', 'submitted'), true],
      ['quoteRequests',count('quote_requests').in('status',['submitted','in_review']),true],
      ['notifications', count('notifications').in('status', ['draft', 'scheduled']), true],
      ['pendingOrders', count('orders').in('status', ['pending', 'under_review', 'approved', 'in_progress', 'ready', 'out_for_delivery']), true],
      ['recentOrders', supabase.from('orders').select('id,order_number,status,total,created_at').order('created_at', { ascending: false }).limit(5)],
      ['recentSupport', supabase.from('support_conversations').select('id,subject,status,priority,last_message_at').order('last_message_at', { ascending: false }).limit(5)],
      ['recentProducts', supabase.from('products').select('id,name_ar,name_en,slug,base_price,image_url,is_active,visibility,stock_mode,stock_quantity').order('created_at', { ascending: false }).limit(4)],
    ];
    const results = await Promise.allSettled(jobs.map(([, query]) => query));
    if (request !== sequence.current) return;
    const next = {}, failed = [];
    results.forEach((result, i) => {
      const [key, , isCount] = jobs[i];
      const response = result.status === 'fulfilled' ? result.value : { error: result.reason };
      if (response.error || (isCount && response.count === null)) { failed.push(key); next[key] = null; }
      else next[key] = isCount ? response.count : response.data || [];
    });
    setSnapshot(next);
    setFailures(failed);
    setUpdatedAt(failed.length === jobs.length ? null : new Date());
    setLoading(false);
    onRefreshBadges?.();
  }, [onRefreshBadges]);
  useEffect(() => { load(); return () => { ++sequence.current; }; }, [load]);
  useAdminLiveRefresh(load, WATCHED);

  const stats = [
    { key: 'orders', icon: PackageSearch, ar: 'الطلبات', en: 'Orders', hint: ar ? 'طلبات الأفراد والمنشآت' : 'Individual & organization orders', path: '/admin/orders' },
    { key: 'published', icon: Boxes, ar: 'منتجات منشورة', en: 'Published products', hint: ar ? 'ظاهرة في المتجر' : 'Visible in the store', path: '/admin/catalog?filter=published' },
    { key: 'users', icon: UsersRound, ar: 'حسابات العملاء', en: 'Customer accounts', hint: ar ? 'الأفراد والمنشآت' : 'Individuals & organizations', path: '/admin/users' },
    { key: 'requests', icon: ClipboardPlus, ar: 'طلبات المنشآت', en: 'B2B requests', hint: ar ? 'بانتظار المراجعة' : 'Awaiting review', path: '/admin/service-requests' },
  ];
  const tasks = [
    { key:'quoteRequests',icon:ClipboardPlus,ar:'طلبات خدمات وتسعير',en:'Service & pricing requests',path:'/admin/quote-requests' },
    { key: 'pendingOrders', icon: PackageSearch, ar: 'طلبات تحتاج متابعة', en: 'Orders to follow up', path: '/admin/orders' },
    { key: 'support', icon: MessageSquareText, ar: 'محادثات مفتوحة', en: 'Open conversations', path: '/admin/support' },
    { key: 'drafts', icon: Boxes, ar: 'منتجات مسودة', en: 'Draft products', path: '/admin/catalog?filter=draft' },
    { key: 'outOfStock', icon: CircleAlert, ar: 'منتجات نفد مخزونها', en: 'Out-of-stock products', path: '/admin/catalog?filter=out-of-stock' },
    { key: 'missingImages', icon: Sparkles, ar: 'منتجات تحتاج صورًا', en: 'Products needing photos', path: '/admin/catalog?filter=missing-images' },
    { key: 'notifications', icon: Globe2, ar: 'إشعارات تنتظر النشر', en: 'Notifications awaiting publishing', path: '/admin/notifications' },
  ];
  const today = new Intl.DateTimeFormat(ar ? 'ar-SA' : 'en-GB', { dateStyle: 'full', timeZone: 'Asia/Riyadh', calendar: 'gregory' }).format(new Date());

  return <div className="admin-page admin-dashboard-page">
    <section className="admin-command-hero">
      <img className="admin-command-watermark" src="/assets/brand/balqees-symbol.webp" alt="" aria-hidden="true"/>
      <div className="admin-command-hero-copy"><span><Sparkles size={16}/>{ar ? 'بلقيس الورد · مركز القيادة' : 'BALQEES FLORAL · COMMAND CENTER'}</span><h2>{ar ? 'إدارة تليق باسم بلقيس' : 'A workspace worthy of Balqees'}</h2><p>{ar ? 'متجرك، عملاؤك وشراكاتك في رؤية واحدة. كل صفحة مرتبطة، وكل قرار يبدأ من بياناتها.' : 'Your store, customers and partnerships in one view. Every page connected, every decision informed.'}</p><div className="admin-command-date"><Clock3 size={15}/><span>{today}</span><span>مكة المكرمة</span></div><div className="admin-command-hero-actions"><Link className="admin-primary-button" to="/admin/catalog?new=product"><Plus size={17}/>{ar ? 'إضافة منتج' : 'Add product'}</Link><Link className="admin-secondary-button" to="/admin/pages"><Globe2 size={17}/>{ar ? 'جميع الصفحات' : 'All pages'}</Link></div></div>
      <div className="admin-command-hero-visual" aria-hidden="true"><img src="/assets/home/floral-signature.webp" alt=""/><span>BALQEES<br/>FLORAL</span></div>
    </section>

    <div className="admin-overview-bar"><div><i className={failures.length ? 'warning' : loading ? 'syncing' : ''}/><span>{loading ? (ar ? 'جاري تحديث البيانات' : 'Refreshing data') : failures.length ? (ar ? 'بعض البيانات غير متاحة' : 'Some data is unavailable') : (ar ? 'متصل ببيانات النظام' : 'Connected to system data')}</span>{updatedAt && <time>{dateTime(updatedAt, lang)}</time>}</div><button className="admin-secondary-button" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''}/>{ar ? 'تحديث' : 'Refresh'}</button></div>
    {!!failures.length && <div className="admin-feedback error" role="alert"><CircleAlert size={18}/><span>{ar ? 'تعذر تحميل جزء من البيانات. الأقسام غير المتاحة تظهر بشرطة؛ أعد التحديث أو افتح القسم المعني.' : 'Some data could not load. Unavailable values appear as a dash; refresh or open the relevant section.'}</span></div>}
    <section className="admin-stat-grid">{stats.map(item => { const Icon = item.icon; return <Link key={item.key} to={item.path} className="admin-stat-card"><div className="admin-stat-card-top"><span><Icon size={21}/></span><ArrowUpLeft size={17}/></div><strong>{loading ? '—' : formatCount(snapshot[item.key], ar)}</strong><h3>{ar ? item.ar : item.en}</h3><p>{item.hint}</p></Link>; })}</section>
    <AdminStoreStatus lang={lang} published={snapshot.published ?? null}/>

    <div className="admin-command-grid">
      <section className="admin-panel admin-action-queue"><div className="admin-panel-head"><div><small>{ar ? 'أولويات اليوم' : 'TODAY’S PRIORITIES'}</small><h3>{ar ? 'خطوتك التالية' : 'Your next step'}</h3></div><Sparkles size={21}/></div><div className="admin-task-grid">{tasks.map(item => { const Icon = item.icon; const value = snapshot[item.key]; return <Link to={item.path} key={item.key} className={value > 0 ? 'needs-attention' : ''}><span><Icon size={18}/>{ar ? item.ar : item.en}</span><strong>{loading ? '—' : formatCount(value, ar)}</strong><ArrowUpLeft size={15}/></Link>; })}</div>{snapshot.categories === 0 && <Link className="admin-category-prompt" to="/admin/catalog?tab=categories">{ar ? 'أضف أصنافًا لتنظيم المتجر وتسهيل التصفية.' : 'Add categories to organize the store and make filtering easier.'}<ArrowUpLeft size={16}/></Link>}</section>
      <section className="admin-panel admin-catalog-preview"><div className="admin-panel-head"><div><small>{ar ? 'من الكتالوج المركزي' : 'CENTRAL CATALOG'}</small><h3>{ar ? 'آخر المنتجات' : 'Latest products'}</h3></div><Link to="/admin/catalog">{ar ? 'إدارة الكل' : 'Manage all'}</Link></div>{snapshot.recentProducts?.length ? <div>{snapshot.recentProducts.map(product => <Link key={product.id} to={`/admin/catalog?edit=${product.id}`}><span className="admin-product-thumb">{product.image_url ? <img src={product.image_url} alt=""/> : <Boxes size={23}/>}</span><div><strong>{ar ? product.name_ar : product.name_en || product.name_ar}</strong><small>{product.is_active && product.visibility === 'public' ? (ar ? 'منشور' : 'Published') : (ar ? 'غير منشور' : 'Unpublished')} · {product.base_price === null ? (ar ? 'حسب الطلب' : 'On request') : money(product.base_price, lang)}</small></div><ArrowUpLeft size={16}/></Link>)}</div> : <Empty ar={ar} unavailable={snapshot.recentProducts === null} loading={loading}/>}</section>
    </div>

    <section className="admin-panel admin-workspace-directory"><div className="admin-panel-head"><div><small>{ar ? 'مساحة عمل مترابطة' : 'CONNECTED WORKSPACE'}</small><h3>{ar ? 'كل أقسام الإدارة' : 'All admin modules'}</h3></div><Link to="/admin/pages">{ar ? 'خريطة صفحات الموقع' : 'Website page map'}<ArrowUpLeft size={16}/></Link></div><div className="admin-module-groups">{ADMIN_GROUPS.filter(group => group.id !== 'command').map(group => <div key={group.id}><h4>{ar ? group.ar : group.en}</h4>{ADMIN_NAV.filter(item => item.group === group.id).map(item => { const Icon = item.icon; return <Link to={item.path} key={item.path}><Icon size={17}/><span>{ar ? item.ar : item.en}</span><ArrowUpLeft size={14}/></Link>; })}</div>)}</div></section>

    <div className="admin-command-grid">
      <section className="admin-panel"><div className="admin-panel-head"><div><small>{ar ? 'الأفراد والمنشآت' : 'INDIVIDUALS & ORGANIZATIONS'}</small><h3>{ar ? 'أحدث الطلبات' : 'Recent orders'}</h3></div><Link to="/admin/orders">{ar ? 'عرض الكل' : 'View all'}</Link></div>{snapshot.recentOrders?.length ? <div className="admin-command-feed">{snapshot.recentOrders.map(order => <Link key={order.id} to={`/admin/orders?order=${order.id}`}><span className="admin-feed-icon"><PackageSearch size={20}/></span><div><strong>#{order.order_number}</strong><small>{statusLabel(order.status, ar)} · {dateTime(order.created_at, lang)}</small></div><b>{money(order.total, lang)}</b></Link>)}</div> : <Empty ar={ar} unavailable={snapshot.recentOrders === null} loading={loading}/>}</section>
      <section className="admin-panel"><div className="admin-panel-head"><div><small>{ar ? 'مركز عناية بلقيس' : 'BALQEES CARE CENTER'}</small><h3>{ar ? 'آخر المحادثات' : 'Recent conversations'}</h3></div><Link to="/admin/support">{ar ? 'فتح التواصل' : 'Open inbox'}</Link></div>{snapshot.recentSupport?.length ? <div className="admin-command-feed">{snapshot.recentSupport.map(item => <Link key={item.id} to="/admin/support"><span className="admin-feed-icon"><MessageSquareText size={20}/></span><div><strong>{item.subject}</strong><small>{statusLabel(item.status, ar)} · {dateTime(item.last_message_at, lang)}</small></div><ArrowUpLeft size={16}/></Link>)}</div> : <Empty ar={ar} unavailable={snapshot.recentSupport === null} loading={loading}/>}</section>
    </div>
  </div>;
}
function Empty({ ar, unavailable, loading }) { return <div className="admin-empty-inline"><Boxes size={22}/><span>{loading ? (ar ? 'جاري القراءة…' : 'Loading…') : unavailable ? (ar ? 'تعذرت قراءة البيانات.' : 'Data could not be read.') : (ar ? 'لا توجد سجلات بعد.' : 'No records yet.')}</span></div>; }
