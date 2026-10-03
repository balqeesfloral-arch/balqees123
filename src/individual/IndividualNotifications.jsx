import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive, ArchiveRestore, ArrowLeft, ArrowRight, Bell, BellRing, CalendarDays,
  Check, CheckCheck, ChevronLeft, ChevronRight, CircleAlert, Clock3, Gift, Heart,
  Home, LoaderCircle, MessageCircleMore, PackageCheck, PackageOpen, RefreshCw,
  Settings2, ShieldCheck, ShoppingBag, Sparkles, Store, Tag, UserRound, X,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import {
  cacheCustomerPreferences,
  normalizeCustomerPreferences,
  notificationAllowed,
} from '../lib/customerPreferences';
import { fmtDate, fmtRelative } from './individualUtils';
import './individual-account.css';
import './individual-notifications.css';

const ESSENTIAL_CATEGORIES = new Set(['order', 'support', 'security', 'account', 'system', 'payment']);
const MARKETING_CATEGORIES = new Set(['marketing', 'offer', 'campaign', 'greeting', 'winback']);
const REMINDER_CATEGORIES = new Set(['occasion', 'abandoned_cart', 'price_drop', 'back_in_stock']);

function textOf(item, ar, key) {
  if (key === 'title') return ar ? item.title_ar : (item.title_en || item.title_ar);
  return ar ? item.body_ar : (item.body_en || item.body_ar);
}

function isEssential(item) {
  const category = String(item?.category || '').toLowerCase();
  const type = String(item?.type || '').toLowerCase();
  return ESSENTIAL_CATEGORIES.has(category) || ['warning', 'system'].includes(type);
}

function isImportant(item) {
  const priority = String(item?.priority || '').toLowerCase();
  const type = String(item?.type || '').toLowerCase();
  const category = String(item?.category || '').toLowerCase();
  const meta = item?.metadata || {};
  return ['high', 'urgent'].includes(priority)
    || ['warning', 'system'].includes(type)
    || ['security', 'payment'].includes(category)
    || meta.requires_action === true
    || meta.requiresAction === true;
}

function groupOf(item) {
  const category = String(item?.category || '').toLowerCase();
  const type = String(item?.type || '').toLowerCase();
  if (isImportant(item)) return 'attention';
  if (['order', 'payment'].includes(category)) return 'orders';
  if (['support', 'account', 'security', 'system'].includes(category)) return 'balqees';
  if (MARKETING_CATEGORIES.has(category) || type === 'offer') return 'marketing';
  if (REMINDER_CATEGORIES.has(category)) return 'reminders';
  return 'other';
}

function groupMeta(group, ar) {
  const data = {
    attention: { icon: CircleAlert, ar: 'يحتاج انتباهك', en: 'Needs your attention', hintAr: 'أشياء تستحق المراجعة الآن.', hintEn: 'Items worth reviewing now.' },
    orders: { icon: PackageCheck, ar: 'طلباتك', en: 'Your orders', hintAr: 'حالة الطلب والتسليم والتحصيل.', hintEn: 'Order, delivery and payment updates.' },
    balqees: { icon: MessageCircleMore, ar: 'رسائل بلقيس', en: 'Balqees messages', hintAr: 'ردود مركز العناية وتحديثات الحساب والأمان.', hintEn: 'Care replies, account and security updates.' },
    marketing: { icon: Sparkles, ar: 'العروض والتهاني', en: 'Offers & greetings', hintAr: 'تظهر فقط إذا سمحت بها إعداداتك.', hintEn: 'Shown only when your preferences allow them.' },
    reminders: { icon: CalendarDays, ar: 'التذكيرات', en: 'Reminders', hintAr: 'المناسبات والسلة والتنبيهات الاختيارية.', hintEn: 'Occasions, cart and optional reminders.' },
    other: { icon: Bell, ar: 'باقي الإشعارات', en: 'Other notifications', hintAr: 'تحديثات أخرى مرتبطة بحسابك.', hintEn: 'Other updates related to your account.' },
  }[group];
  return { ...data, title: ar ? data.ar : data.en, hint: ar ? data.hintAr : data.hintEn };
}

function categoryLabel(item, ar) {
  const category = String(item?.category || '').toLowerCase();
  const labels = {
    order: ['طلب', 'Order'], support: ['فريق بلقيس', 'Balqees Care'], security: ['أمان', 'Security'],
    account: ['الحساب', 'Account'], payment: ['الدفع', 'Payment'], system: ['النظام', 'System'],
    occasion: ['مناسبة', 'Occasion'], abandoned_cart: ['السلة', 'Cart'], price_drop: ['السعر', 'Price'],
    back_in_stock: ['التوفر', 'Availability'], greeting: ['تهنئة', 'Greeting'], winback: ['رسالة بلقيس', 'Balqees'],
    marketing: ['عرض', 'Offer'], offer: ['عرض', 'Offer'], campaign: ['حملة', 'Campaign'],
  };
  return labels[category]?.[ar ? 0 : 1] || (ar ? 'إشعار' : 'Notification');
}

function notificationIcon(item) {
  const category = String(item?.category || '').toLowerCase();
  const type = String(item?.type || '').toLowerCase();
  if (category === 'order' || category === 'payment') return PackageCheck;
  if (category === 'support') return MessageCircleMore;
  if (category === 'security' || category === 'account' || type === 'system') return ShieldCheck;
  if (category === 'occasion') return Gift;
  if (category === 'abandoned_cart') return ShoppingBag;
  if (category === 'price_drop' || category === 'back_in_stock') return Tag;
  if (MARKETING_CATEGORIES.has(category) || type === 'offer') return Sparkles;
  return Bell;
}

function muteSettingFor(item) {
  if (isEssential(item)) return null;
  const category = String(item?.category || '').toLowerCase();
  const type = String(item?.type || '').toLowerCase();
  if (category === 'occasion') return { field: 'occasion_reminders', ar: 'تذكيرات المناسبات', en: 'occasion reminders' };
  if (category === 'abandoned_cart') return { field: 'abandoned_cart_messages', ar: 'تذكيرات السلة', en: 'cart reminders' };
  if (category === 'price_drop') return { field: 'price_drop_alerts', ar: 'تنبيهات نزول السعر', en: 'price-drop alerts' };
  if (category === 'back_in_stock') return { field: 'back_in_stock_alerts', ar: 'تنبيهات رجوع المنتج', en: 'back-in-stock alerts' };
  if (category === 'greeting') return { field: 'greeting_messages', ar: 'رسائل التهنئة', en: 'greeting messages' };
  if (category === 'winback') return { field: 'winback_messages', ar: 'رسائل العودة', en: 'win-back messages' };
  if (MARKETING_CATEGORIES.has(category) || type === 'offer') return { field: 'marketing_in_app', ar: 'العروض والتسويق', en: 'offers and marketing' };
  return null;
}

function safeAction(item) {
  if (item?.action_url?.startsWith('/')) return item.action_url;
  const meta = item?.metadata || {};
  const category = String(item?.category || '').toLowerCase();
  if (category === 'support' && meta.conversation_id) return `/account/support?conversation=${encodeURIComponent(meta.conversation_id)}`;
  if (['order', 'payment'].includes(category) && meta.order_id) return `/account/orders/${encodeURIComponent(meta.order_id)}`;
  if (category === 'occasion') return '/account/occasions';
  if (category === 'abandoned_cart') return '/account/cart';
  if (['price_drop', 'back_in_stock', 'marketing', 'offer', 'campaign', 'greeting', 'winback'].includes(category)) return '/store';
  if (category === 'security' || category === 'account') return '/account/profile';
  return null;
}

function NotificationCard({ item, readState, ar, lang, onOpen, onArchive, onRestore, onMute, busy }) {
  const Icon = notificationIcon(item);
  const unread = !readState?.read_at;
  const archived = !!readState?.archived_at;
  const important = isImportant(item);
  const mute = muteSettingFor(item);
  const action = safeAction(item);
  const actionLabel = ar ? item.action_label_ar : (item.action_label_en || item.action_label_ar);
  const published = item.published_at || item.created_at;
  return <article className={`individual-notification-card ${unread ? 'unread' : 'read'} ${important ? 'important' : ''} ${archived ? 'archived' : ''}`}>
    <button type="button" className="individual-notification-main" onClick={() => onOpen(item)}>
      <span className="individual-notification-icon"><Icon size={20}/></span>
      <div className="individual-notification-copy">
        <div className="individual-notification-meta"><span>{categoryLabel(item, ar)}</span>{unread && <em>{ar ? 'جديد' : 'New'}</em>}{important && <b>{ar ? 'مهم' : 'Important'}</b>}</div>
        <strong>{textOf(item, ar, 'title')}</strong>
        <p>{textOf(item, ar, 'body')}</p>
        <small><Clock3 size={13}/>{fmtRelative(published, lang)} · {fmtDate(published, lang, true)}</small>
      </div>
      <ChevronLeft className={ar ? '' : 'ltr-chevron'} size={18}/>
    </button>
    <div className="individual-notification-actions">
      {action && <button type="button" className="primary" disabled={busy} onClick={() => onOpen(item, true)}>{actionLabel || (ar ? 'فتح الإجراء' : 'Open action')}<ArrowLeft className={ar ? '' : 'ltr-arrow'} size={14}/></button>}
      {archived
        ? <button type="button" disabled={busy} onClick={() => onRestore(item)}><ArchiveRestore size={14}/>{ar ? 'استعادة' : 'Restore'}</button>
        : <button type="button" disabled={busy} onClick={() => onArchive(item)}><Archive size={14}/>{ar ? 'أرشفة' : 'Archive'}</button>}
      {mute && !archived && <button type="button" className="quiet" disabled={busy} onClick={() => onMute(item, mute)}><BellRing size={14}/>{ar ? 'لا أريد هذا النوع' : 'Mute this type'}</button>}
    </div>
  </article>;
}

export default function IndividualNotifications({ lang, session }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const uid = session?.user?.id;
  const cart = useBalqeesCart(uid || null);
  const [profile, setProfile] = useState(null);
  const [rows, setRows] = useState([]);
  const [reads, setReads] = useState(new Map());
  const [preferences, setPreferences] = useState(normalizeCustomerPreferences());
  const [hasPreferenceRow, setHasPreferenceRow] = useState(false);
  const [tab, setTab] = useState('new');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    document.body.classList.add('individual-account-active');
    return () => document.body.classList.remove('individual-account-active');
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function load(silent = false) {
    if (!supabase || !uid) return;
    silent ? setRefreshing(true) : setLoading(true);
    try { await supabase.rpc('customer_archive_old_notification_reads'); } catch { /* best effort */ }
    const [profileResult, notificationResult, readResult, prefResult] = await Promise.all([
      supabase.from('customer_profiles').select('full_name,username').eq('id', uid).maybeSingle(),
      supabase.from('notifications').select('*').order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(160),
      supabase.from('notification_reads').select('*').eq('user_id', uid),
      supabase.from('customer_preferences').select('*').eq('user_id', uid).maybeSingle(),
    ]);
    setProfile(profileResult.data || null);
    setRows(notificationResult.data || []);
    setReads(new Map((readResult.data || []).map(row => [String(row.notification_id), row])));
    setHasPreferenceRow(!!prefResult.data);
    const next = normalizeCustomerPreferences(prefResult.data || {});
    setPreferences(next);
    cacheCustomerPreferences(uid, next);
    setLoading(false); setRefreshing(false);
  }

  useEffect(() => { load(); }, [uid]);

  const fullName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || (ar ? 'عميل بلقيس' : 'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];

  const visibleRows = useMemo(() => {
    const now = Date.now();
    return rows.filter(item => {
      const read = reads.get(String(item.id));
      if (read?.dismissed_at) return false;
      if (item.expires_at && new Date(item.expires_at).getTime() < now) return false;
      if (tab !== 'archived' && !notificationAllowed(item, preferences)) return false;
      if (tab === 'archived') return !!read?.archived_at && notificationAllowed(item, preferences);
      if (tab === 'important') return !read?.archived_at && isImportant(item) && notificationAllowed(item, preferences);
      return !read?.archived_at && notificationAllowed(item, preferences);
    });
  }, [rows, reads, preferences, tab]);

  const unreadCount = useMemo(() => rows.filter(item => {
    const read = reads.get(String(item.id));
    return !read?.read_at && !read?.archived_at && !read?.dismissed_at && notificationAllowed(item, preferences) && (!item.expires_at || new Date(item.expires_at).getTime() >= Date.now());
  }).length, [rows, reads, preferences]);

  const importantCount = useMemo(() => rows.filter(item => {
    const read = reads.get(String(item.id));
    return !read?.archived_at && !read?.dismissed_at && isImportant(item) && notificationAllowed(item, preferences);
  }).length, [rows, reads, preferences]);
  const archivedCount = useMemo(() => [...reads.values()].filter(row => row.archived_at && !row.dismissed_at).length, [reads]);

  const grouped = useMemo(() => {
    const order = ['attention', 'orders', 'balqees', 'marketing', 'reminders', 'other'];
    const map = Object.fromEntries(order.map(key => [key, []]));
    visibleRows.forEach(item => map[groupOf(item)].push(item));
    return order.map(key => ({ key, items: map[key] })).filter(section => section.items.length);
  }, [visibleRows]);

  async function markRead(item) {
    if (!item?.id || reads.get(String(item.id))?.read_at) return true;
    const current = reads.get(String(item.id)) || {};
    const payload = { notification_id: item.id, user_id: uid, read_at: new Date().toISOString(), archived_at: current.archived_at || null, dismissed_at: current.dismissed_at || null };
    const { data, error } = await supabase.from('notification_reads').upsert(payload, { onConflict: 'notification_id,user_id' }).select('*').maybeSingle();
    if (error) return false;
    setReads(prev => new Map(prev).set(String(item.id), data || payload));
    return true;
  }

  async function openNotification(item, forceAction = false) {
    await markRead(item);
    const action = safeAction(item);
    if (action && (forceAction || item.action_url || isImportant(item))) navigate(action);
  }

  async function markAllRead() {
    const target = rows.filter(item => {
      const state = reads.get(String(item.id));
      return !state?.read_at && !state?.archived_at && !state?.dismissed_at && notificationAllowed(item, preferences);
    });
    if (!target.length) return;
    setBusy('read-all');
    const now = new Date().toISOString();
    const payload = target.map(item => ({ notification_id: item.id, user_id: uid, read_at: now }));
    const { error } = await supabase.from('notification_reads').upsert(payload, { onConflict: 'notification_id,user_id' });
    setBusy('');
    if (error) return setNotice({ type: 'error', text: ar ? 'تعذر تعليم الإشعارات كمقروءة.' : 'Could not mark notifications as read.' });
    setReads(prev => {
      const next = new Map(prev);
      target.forEach(item => next.set(String(item.id), { ...(next.get(String(item.id)) || {}), notification_id: item.id, user_id: uid, read_at: now }));
      return next;
    });
    setNotice({ type: 'success', text: ar ? 'تمت قراءة جميع الإشعارات الحالية.' : 'All current notifications are marked as read.' });
  }

  async function archiveNotification(item) {
    setBusy(`archive-${item.id}`);
    const current = reads.get(String(item.id)) || {};
    const now = new Date().toISOString();
    const payload = { notification_id: item.id, user_id: uid, read_at: current.read_at || now, archived_at: now, dismissed_at: current.dismissed_at || null };
    const { data, error } = await supabase.from('notification_reads').upsert(payload, { onConflict: 'notification_id,user_id' }).select('*').maybeSingle();
    setBusy('');
    if (error) return setNotice({ type: 'error', text: ar ? 'تعذر أرشفة الإشعار.' : 'Could not archive the notification.' });
    setReads(prev => new Map(prev).set(String(item.id), data || payload));
  }

  async function restoreNotification(item) {
    setBusy(`restore-${item.id}`);
    const current = reads.get(String(item.id)) || {};
    const { data, error } = await supabase.from('notification_reads').upsert({ notification_id: item.id, user_id: uid, read_at: current.read_at || new Date().toISOString(), archived_at: null, dismissed_at: current.dismissed_at || null }, { onConflict: 'notification_id,user_id' }).select('*').maybeSingle();
    setBusy('');
    if (error) return setNotice({ type: 'error', text: ar ? 'تعذر استعادة الإشعار.' : 'Could not restore the notification.' });
    setReads(prev => new Map(prev).set(String(item.id), data));
  }

  async function savePreferencePatch(patch) {
    const payload = { ...patch, updated_at: new Date().toISOString() };
    const request = hasPreferenceRow
      ? supabase.from('customer_preferences').update(payload).eq('user_id', uid).select('*').maybeSingle()
      : supabase.from('customer_preferences').insert({ user_id: uid, ...preferences, ...patch }).select('*').maybeSingle();
    const { data, error } = await request;
    if (error) return { ok: false, error };
    setHasPreferenceRow(true);
    const next = normalizeCustomerPreferences(data || { ...preferences, ...patch });
    setPreferences(next); cacheCustomerPreferences(uid, next);
    return { ok: true, preferences: next };
  }

  async function muteType(item, mute) {
    setBusy(`mute-${item.id}`);
    const result = await savePreferencePatch({ [mute.field]: false });
    if (!result.ok) {
      setBusy('');
      return setNotice({ type: 'error', text: ar ? 'تعذر كتم هذا النوع الآن.' : 'Could not mute this notification type.' });
    }
    const current = reads.get(String(item.id)) || {};
    const now = new Date().toISOString();
    const payload = { notification_id: item.id, user_id: uid, read_at: current.read_at || now, archived_at: current.archived_at || null, dismissed_at: now };
    const { data } = await supabase.from('notification_reads').upsert(payload, { onConflict: 'notification_id,user_id' }).select('*').maybeSingle();
    setReads(prev => new Map(prev).set(String(item.id), data || payload));
    setBusy('');
    setNotice({ type: 'success', text: ar ? `تم إيقاف ${mute.ar}. تقدر ترجعها من الإعدادات.` : `${mute.en} were turned off. You can re-enable them in Settings.` });
  }

  if (loading) return <div className="individual-page"><div className="individual-center-state"><LoaderCircle className="spin"/><strong>{ar ? 'نجمع إشعاراتك…' : 'Loading your notifications…'}</strong></div></div>;

  return <div className="individual-page individual-notifications-page" dir={ar ? 'rtl' : 'ltr'}>
    <header className="individual-topbar"><div className="individual-shell individual-topbar-inner">
      <Link to="/" className="individual-brand"><BrandMark/></Link>
      <div className="individual-topbar-center"><span>{ar ? 'مركز الإشعارات' : 'NOTIFICATION CENTER'}</span><small>{ar ? 'حساب فردي' : 'INDIVIDUAL ACCOUNT'}</small></div>
      <div className="individual-top-actions">
        <button type="button" className="individual-icon-button active" aria-label={ar ? 'الإشعارات' : 'Notifications'}><Bell size={19}/>{unreadCount > 0 && <b>{Math.min(unreadCount, 99)}</b>}</button>
        <button type="button" className="individual-icon-button" onClick={() => navigate('/account/cart')} aria-label={ar ? 'السلة' : 'Cart'}><ShoppingBag size={19}/>{cart.count > 0 && <b>{Math.min(cart.count,99)}</b>}</button>
        <button type="button" className="individual-profile-chip" onClick={() => navigate('/account/profile')}><span>{fullName.slice(0,1).toUpperCase()}</span><div><small>{ar ? 'مرحبًا' : 'Welcome'}</small><strong>{firstName}</strong></div></button>
      </div>
    </div></header>

    <main className="individual-shell individual-notifications-main">
      {notice && <div className={`individual-inline-notice ${notice.type}`}>{notice.type === 'success' ? <Check/> : <CircleAlert/>}<span>{notice.text}</span><button type="button" onClick={() => setNotice(null)}><X/></button></div>}

      <section className="individual-notifications-intro">
        <div><span>{ar ? 'BALQEES NOTIFICATIONS' : 'BALQEES NOTIFICATIONS'}</span><h1>{ar ? 'كل المهم، بدون ضوضاء.' : 'What matters, without the noise.'}</h1><p>{ar ? 'الطلبات وردود فريق بلقيس والأمان أولًا. العروض والتذكيرات تظهر فقط حسب اختياراتك.' : 'Orders, Balqees Care and security come first. Offers and reminders appear only when your preferences allow them.'}</p></div>
        <div className="individual-notifications-toolbar"><button type="button" onClick={() => load(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''}/>{ar ? 'تحديث' : 'Refresh'}</button><button type="button" onClick={markAllRead} disabled={!unreadCount || busy === 'read-all'}>{busy === 'read-all' ? <LoaderCircle className="spin"/> : <CheckCheck/>}{ar ? 'قراءة الكل' : 'Mark all read'}</button><Link to="/account/settings"><Settings2/>{ar ? 'إعدادات الإشعارات' : 'Notification settings'}</Link></div>
      </section>

      <section className="individual-notifications-summary" aria-label={ar ? 'ملخص الإشعارات' : 'Notification summary'}>
        <button type="button" className={tab === 'new' ? 'active' : ''} onClick={() => setTab('new')}><span><BellRing/></span><div><strong>{unreadCount}</strong><small>{ar ? 'جديد غير مقروء' : 'Unread'}</small></div></button>
        <button type="button" className={tab === 'important' ? 'active' : ''} onClick={() => setTab('important')}><span><CircleAlert/></span><div><strong>{importantCount}</strong><small>{ar ? 'مهم' : 'Important'}</small></div></button>
        <button type="button" className={tab === 'archived' ? 'active' : ''} onClick={() => setTab('archived')}><span><Archive/></span><div><strong>{archivedCount}</strong><small>{ar ? 'مؤرشف' : 'Archived'}</small></div></button>
      </section>

      {preferences.quiet_mode && <section className="individual-notifications-quiet"><ShieldCheck/><div><strong>{ar ? 'الوضع الهادئ مفعّل' : 'Quiet mode is on'}</strong><p>{ar ? 'نعرض لك هنا الطلبات والأمان وردود بلقيس والأشياء الضرورية فقط. التسويق والتذكيرات غير المهمة متوقفة.' : 'Only operational, security and Balqees Care updates are shown. Marketing and non-essential reminders are suppressed.'}</p></div><Link to="/account/settings">{ar ? 'تعديل الوضع' : 'Adjust mode'}</Link></section>}

      {grouped.length ? <div className="individual-notifications-sections">
        {grouped.map(section => {
          const meta = groupMeta(section.key, ar); const Icon = meta.icon;
          return <section className={`individual-notification-section group-${section.key}`} key={section.key}>
            <div className="individual-notification-section-head"><span><Icon size={19}/></span><div><h2>{meta.title}</h2><p>{meta.hint}</p></div><em>{section.items.length}</em></div>
            <div className="individual-notification-list">{section.items.map(item => <NotificationCard key={item.id} item={item} readState={reads.get(String(item.id))} ar={ar} lang={lang} onOpen={openNotification} onArchive={archiveNotification} onRestore={restoreNotification} onMute={muteType} busy={busy === `archive-${item.id}` || busy === `restore-${item.id}` || busy === `mute-${item.id}`}/>)}</div>
          </section>;
        })}
      </div> : <section className="individual-notifications-empty"><span><Bell size={28}/></span><h2>{tab === 'archived' ? (ar ? 'الأرشيف هادئ' : 'Your archive is quiet') : tab === 'important' ? (ar ? 'ما عندك شيء مهم يحتاج انتباهك' : 'Nothing important needs your attention') : (ar ? 'كل شيء تحت السيطرة' : 'Everything is under control')}</h2><p>{tab === 'archived' ? (ar ? 'الإشعارات التي تؤرشفها ستبقى هنا ويمكن استعادتها.' : 'Notifications you archive will stay here and can be restored.') : (ar ? 'تحديثات الطلب ورسائل بلقيس ستظهر هنا عند وجودها.' : 'Order updates and Balqees messages will appear here when relevant.')}</p>{tab !== 'new' && <button type="button" onClick={() => setTab('new')}>{ar ? 'العودة للإشعارات الحالية' : 'Back to current notifications'}</button>}</section>}

      <section className="individual-notifications-footnote"><ShieldCheck/><div><strong>{ar ? 'الأشياء الضرورية لا تُكتم' : 'Essential updates stay on'}</strong><p>{ar ? 'حالة الطلب، الأمان، الدفع، والمشكلة التي تحتاج إجراء منك تبقى ظاهرة حتى لا يفوتك شيء تشغيلي مهم.' : 'Order status, security, payment and action-required notices stay visible so you do not miss an important operational update.'}</p></div></section>
    </main>

    <nav className="individual-mobile-dock"><Link to="/account"><Home/><span>{ar ? 'الرئيسية' : 'Home'}</span></Link><Link to="/account/orders"><PackageOpen/><span>{ar ? 'طلباتي' : 'Orders'}</span></Link><Link to="/store"><Store/><span>{ar ? 'المتجر' : 'Store'}</span></Link><Link to="/account/favorites"><Heart/><span>{ar ? 'المفضلة' : 'Favorites'}</span></Link><Link className="active" to="/account/profile"><UserRound/><span>{ar ? 'حسابي' : 'Account'}</span></Link></nav>
  </div>;
}
