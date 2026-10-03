import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpLeft,
  BadgePercent,
  BellRing,
  Boxes,
  CircleAlert,
  CircleCheck,
  Clock3,
  Gift,
  MessageSquareText,
  PackageSearch,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { dateTime, money } from '../adminUtils';

const emptyStats = { users: 0, products: 0, orders: 0, openSupport: 0, activeOffers: 0, draftNotifications: 0 };

export default function AdminDashboard({ lang, onRefreshBadges }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const [stats, setStats] = useState(emptyStats);
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentSupport, setRecentSupport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(new Date());

  async function load() {
    setLoading(true);
    const [users, products, orders, support, offers, notifications, usersRows, ordersRows, supportRows] = await Promise.all([
      supabase.from('customer_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('support_conversations').select('id', { count: 'exact', head: true }).in('status', ['open','pending']),
      supabase.from('offers').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).in('status', ['draft','scheduled']),
      supabase.from('customer_profiles').select('id,full_name,email,account_type,establishment_display_name,created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('orders').select('id,order_number,user_id,status,total,created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('support_conversations').select('id,user_id,subject,status,priority,last_message_at').order('last_message_at', { ascending: false }).limit(5),
    ]);

    setStats({
      users: users.count || 0,
      products: products.count || 0,
      orders: orders.count || 0,
      openSupport: support.count || 0,
      activeOffers: offers.count || 0,
      draftNotifications: notifications.count || 0,
    });
    setRecentUsers(usersRows.data || []);
    setRecentOrders(ordersRows.data || []);
    setRecentSupport(supportRows.data || []);
    setUpdatedAt(new Date());
    setLoading(false);
    onRefreshBadges?.();
  }

  useEffect(() => { load(); }, []);

  const today = useMemo(() => {
    const greg = new Intl.DateTimeFormat(ar ? 'ar-SA' : 'en-GB', { dateStyle: 'full', timeZone: 'Asia/Riyadh' }).format(new Date());
    let hijri = '';
    try { hijri = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-islamic-umalqura' : 'en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date()); } catch { /* noop */ }
    return { greg, hijri };
  }, [ar]);

  const cards = [
    { key: 'users', value: stats.users, icon: UsersRound, title: ar ? 'المستخدمون' : 'Users', hint: ar ? 'حساب مسجل' : 'registered accounts', path: '/admin/users' },
    { key: 'orders', value: stats.orders, icon: PackageSearch, title: ar ? 'الطلبات' : 'Orders', hint: ar ? 'طلب في النظام' : 'orders in system', path: '/admin/orders' },
    { key: 'products', value: stats.products, icon: Boxes, title: ar ? 'المنتجات' : 'Products', hint: ar ? 'منتج مُدار' : 'managed products', path: '/admin/catalog' },
    { key: 'support', value: stats.openSupport, icon: MessageSquareText, title: ar ? 'التواصل المفتوح' : 'Open support', hint: ar ? 'محادثة تحتاج متابعة' : 'conversations to review', path: '/admin/support', alert: stats.openSupport > 0 },
  ];

  const signals = [
    stats.products === 0 ? { icon: Boxes, tone: 'warn', title: ar ? 'الكتالوج جاهز للبداية' : 'Catalog is ready to start', text: ar ? 'قاعدة المنتجات والأصناف جاهزة، ولم تتم إضافة منتجات بعد.' : 'Product and category infrastructure is ready; no products have been added yet.', path: '/admin/catalog' } : null,
    stats.openSupport > 0 ? { icon: CircleAlert, tone: 'danger', title: ar ? 'يوجد تواصل يحتاج اهتمامك' : 'Support needs attention', text: ar ? `${stats.openSupport} محادثة مفتوحة أو معلّقة.` : `${stats.openSupport} open or pending conversations.`, path: '/admin/support' } : { icon: CircleCheck, tone: 'good', title: ar ? 'صندوق التواصل هادئ' : 'Support inbox is clear', text: ar ? 'لا توجد محادثات مفتوحة حاليًا.' : 'There are no open support conversations right now.', path: '/admin/support' },
    stats.draftNotifications > 0 ? { icon: BellRing, tone: 'info', title: ar ? 'إشعارات بانتظار الإرسال' : 'Notifications awaiting delivery', text: ar ? `${stats.draftNotifications} إشعار مسودة أو مجدول.` : `${stats.draftNotifications} draft or scheduled notifications.`, path: '/admin/notifications' } : null,
    stats.activeOffers > 0 ? { icon: Gift, tone: 'good', title: ar ? 'العروض النشطة' : 'Active offers', text: ar ? `${stats.activeOffers} عرض ظاهر حاليًا.` : `${stats.activeOffers} offer(s) currently active.`, path: '/admin/offers' } : null,
  ].filter(Boolean);

  return <div className="admin-page admin-dashboard-page">
    <section className="admin-hero-panel">
      <div className="admin-hero-copy"><span><Sparkles size={15}/>{ar ? 'لوحة القيادة الذكية' : 'INTELLIGENT CONTROL CENTER'}</span><h2>{ar ? 'كل شيء أمامك، بدون ضوضاء.' : 'Everything in view, without the noise.'}</h2><p>{ar ? 'إدارة العملاء والمنتجات والطلبات والعروض والتواصل من مركز واحد مصمم لاتخاذ القرار بسرعة.' : 'Manage clients, catalog, orders, offers and communication from one decision-focused control center.'}</p><div className="admin-date-line"><Clock3 size={15}/><span>{today.greg}</span>{today.hijri && <em>{today.hijri}</em>}</div></div>
      <div className="admin-hero-actions"><button className="admin-primary-button" onClick={() => navigate('/admin/catalog')}><Boxes size={17}/>{ar ? 'إضافة منتج' : 'Add product'}</button><button className="admin-secondary-button" onClick={() => navigate('/admin/notifications')}><BellRing size={17}/>{ar ? 'إنشاء إشعار' : 'Create notification'}</button><button className="admin-icon-button" onClick={load} title={ar ? 'تحديث' : 'Refresh'}><RefreshCw className={loading ? 'spin' : ''} size={18}/></button></div>
    </section>

    <section className="admin-stat-grid">
      {cards.map(card => { const Icon = card.icon; return <button key={card.key} className={`admin-stat-card ${card.alert ? 'attention' : ''}`} onClick={() => navigate(card.path)}><div className="admin-stat-card-top"><span><Icon size={20}/></span><TrendingUp size={16}/></div><strong>{loading ? '—' : card.value.toLocaleString(ar ? 'ar-SA' : 'en-US')}</strong><h3>{card.title}</h3><p>{card.hint}</p><i><ArrowUpLeft size={15}/></i></button>; })}
    </section>

    <div className="admin-dashboard-grid">
      <section className="admin-panel admin-smart-panel">
        <div className="admin-panel-head"><div><small>{ar ? 'قراءة سريعة' : 'SMART SIGNALS'}</small><h3>{ar ? 'ما الذي يحتاج انتباهك؟' : 'What needs your attention?'}</h3></div><Sparkles size={20}/></div>
        <div className="admin-signal-list">{signals.map((signal, i) => { const Icon = signal.icon; return <button className={`admin-signal ${signal.tone}`} key={i} onClick={() => navigate(signal.path)}><span><Icon size={18}/></span><div><strong>{signal.title}</strong><p>{signal.text}</p></div><ArrowUpLeft size={16}/></button>; })}</div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head"><div><small>{ar ? 'اختصارات' : 'QUICK ACTIONS'}</small><h3>{ar ? 'ابدأ المهمة مباشرة' : 'Start a task immediately'}</h3></div></div>
        <div className="admin-quick-grid">
          <button onClick={() => navigate('/admin/users')}><UserPlus size={20}/><span>{ar ? 'إدارة المستخدمين' : 'Manage users'}</span></button>
          <button onClick={() => navigate('/admin/discounts')}><BadgePercent size={20}/><span>{ar ? 'خصم جديد' : 'New discount'}</span></button>
          <button onClick={() => navigate('/admin/offers')}><Gift size={20}/><span>{ar ? 'إدارة العروض' : 'Manage offers'}</span></button>
          <button onClick={() => navigate('/admin/support')}><MessageSquareText size={20}/><span>{ar ? 'فتح التواصل' : 'Open inbox'}</span></button>
        </div>
      </section>
    </div>

    <div className="admin-dashboard-grid three-columns">
      <section className="admin-panel admin-table-panel"><div className="admin-panel-head"><div><small>{ar ? 'أحدث الحسابات' : 'LATEST ACCOUNTS'}</small><h3>{ar ? 'المستخدمون الجدد' : 'New users'}</h3></div><button onClick={() => navigate('/admin/users')}>{ar ? 'عرض الكل' : 'View all'}</button></div>{recentUsers.length ? <div className="admin-mini-list">{recentUsers.map(user => <button key={user.id} onClick={() => navigate('/admin/users')}><span className="admin-mini-avatar">{(user.full_name || user.email || 'B')[0]}</span><div><strong>{user.full_name || user.email || '—'}</strong><small>{user.establishment_display_name || (user.account_type === 'company' ? (ar ? 'منشأة' : 'Organization') : (ar ? 'فردي' : 'Individual'))}</small></div><time>{dateTime(user.created_at, lang)}</time></button>)}</div> : <Empty text={ar ? 'لا توجد حسابات حتى الآن.' : 'No accounts yet.'}/>}</section>
      <section className="admin-panel admin-table-panel"><div className="admin-panel-head"><div><small>{ar ? 'المبيعات والطلبات' : 'ORDERS'}</small><h3>{ar ? 'آخر الطلبات' : 'Latest orders'}</h3></div><button onClick={() => navigate('/admin/orders')}>{ar ? 'عرض الكل' : 'View all'}</button></div>{recentOrders.length ? <div className="admin-mini-list">{recentOrders.map(order => <button key={order.id} onClick={() => navigate('/admin/orders')}><span className="admin-mini-avatar order">#{order.order_number}</span><div><strong>{money(order.total, lang)}</strong><small>{order.status}</small></div><time>{dateTime(order.created_at, lang)}</time></button>)}</div> : <Empty text={ar ? 'لا توجد طلبات بعد.' : 'No orders yet.'}/>}</section>
      <section className="admin-panel admin-table-panel"><div className="admin-panel-head"><div><small>{ar ? 'صندوق التواصل' : 'COMMUNICATION'}</small><h3>{ar ? 'آخر المحادثات' : 'Recent conversations'}</h3></div><button onClick={() => navigate('/admin/support')}>{ar ? 'فتح الصندوق' : 'Open inbox'}</button></div>{recentSupport.length ? <div className="admin-mini-list">{recentSupport.map(item => <button key={item.id} onClick={() => navigate('/admin/support')}><span className={`admin-mini-avatar support ${item.priority}`}>{item.priority === 'urgent' ? '!' : '•'}</span><div><strong>{item.subject}</strong><small>{item.status} · {item.priority}</small></div><time>{dateTime(item.last_message_at, lang)}</time></button>)}</div> : <Empty text={ar ? 'لا توجد محادثات حاليًا.' : 'No conversations right now.'}/>}</section>
    </div>

    <div className="admin-last-sync">{ar ? 'آخر تحديث' : 'Last updated'}: {dateTime(updatedAt, lang)}</div>
  </div>;
}

function Empty({ text }) { return <div className="admin-empty-inline"><FileTextIcon/><span>{text}</span></div>; }
function FileTextIcon() { return <span className="admin-empty-icon"><Boxes size={20}/></span>; }
