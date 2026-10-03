import { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Inbox,
  LoaderCircle,
  MessageSquareText,
  PackageSearch,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSystemSettings } from '../lib/systemSettings';

const orderLabels = {
  ar: { pending: 'جديد', under_review: 'قيد المراجعة', quoted: 'تم التسعير', approved: 'معتمد', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي' },
  en: { pending: 'Pending', under_review: 'Under review', quoted: 'Quoted', approved: 'Approved', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' },
};

function fmt(value, lang) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh',
  }).format(date);
}

function sar(value, lang) {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-SA', {
    style: 'currency', currency: 'SAR', maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function ClientPortalHub({ lang, session }) {
  const ar = lang === 'ar';
  const { settings: systemSettings } = useSystemSettings();
  const notificationSettings = systemSettings.notifications;
  const supportSettings = systemSettings.support;
  const Arrow = ar ? ChevronLeft : ChevronRight;
  const [tab, setTab] = useState('notifications');
  const [notifications, setNotifications] = useState([]);
  const [reads, setReads] = useState(new Set());
  const [orders, setOrders] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!supabase || !session?.user?.id) return;
    setLoading(true);
    setError('');
    const [n, r, o, c] = await Promise.all([
      notificationSettings.inApp !== false ? supabase.from('notifications').select('*').order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
      notificationSettings.inApp !== false ? supabase.from('notification_reads').select('notification_id').eq('user_id', session.user.id) : Promise.resolve({ data: [], error: null }),
      supabase.from('orders').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(30),
      supportSettings.signedInTickets !== false ? supabase.from('support_conversations').select('*').eq('user_id', session.user.id).order('last_message_at', { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null }),
    ]);
    const firstError = n.error || r.error || o.error || c.error;
    if (firstError) setError(ar ? 'تعذر تحميل بعض بيانات حسابك الآن.' : 'Some account data could not be loaded right now.');
    setNotifications(n.data || []);
    setReads(new Set((r.data || []).map(x => x.notification_id)));
    setOrders(o.data || []);
    setConversations(c.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [session?.user?.id, notificationSettings.inApp, supportSettings.signedInTickets]);

  useEffect(() => {
    if (tab === 'notifications' && notificationSettings.inApp === false) setTab(supportSettings.signedInTickets !== false ? 'support' : 'orders');
    if (tab === 'support' && supportSettings.signedInTickets === false) setTab(notificationSettings.inApp !== false ? 'notifications' : 'orders');
  }, [notificationSettings.inApp, supportSettings.signedInTickets, tab]);

  const unread = useMemo(() => notifications.filter(x => !reads.has(x.id)).length, [notifications, reads]);
  const openSupport = useMemo(() => conversations.filter(x => x.status !== 'closed').length, [conversations]);

  async function markRead(id) {
    if (reads.has(id)) return;
    const { error: err } = await supabase.from('notification_reads').upsert({ notification_id: id, user_id: session.user.id }, { onConflict: 'notification_id,user_id' });
    if (!err) setReads(current => new Set([...current, id]));
  }

  async function openConversation(item) {
    setSelectedConversation(item);
    setReply('');
    const { data, error: err } = await supabase.from('support_messages').select('*').eq('conversation_id', item.id).order('created_at');
    setMessages(data || []);
    if (err) setError(ar ? 'تعذر تحميل الرسائل.' : 'Could not load messages.');
  }

  async function sendReply(e) {
    e.preventDefault();
    if (!reply.trim() || !selectedConversation || sending) return;
    setSending(true);
    const body = reply.trim();
    const { data, error: err } = await supabase.from('support_messages').insert({
      conversation_id: selectedConversation.id,
      sender_id: session.user.id,
      sender_role: 'user',
      body,
    }).select().single();
    if (!err && data) {
      setMessages(current => [...current, data]);
      setReply('');
      setConversations(current => current.map(x => x.id === selectedConversation.id ? { ...x, last_message_at: data.created_at } : x));
    } else if (err) setError(ar ? 'تعذر إرسال الرد الآن.' : 'Could not send the reply right now.');
    setSending(false);
  }

  const tabs = [
    notificationSettings.inApp !== false ? ['notifications', BellRing, ar ? 'الإشعارات' : 'Notifications', unread] : null,
    supportSettings.signedInTickets !== false ? ['support', MessageSquareText, ar ? 'التواصل' : 'Support', openSupport] : null,
    ['orders', PackageSearch, ar ? 'طلباتي' : 'Orders', orders.length],
  ].filter(Boolean);

  return <section className="client-portal-hub">
    <div className="client-portal-head">
      <div><span><Sparkles size={14}/>{ar ? 'بوابة العميل' : 'CLIENT PORTAL'}</span><h3>{ar ? 'حسابك في مكان واحد' : 'Your account in one place'}</h3><p>{ar ? 'طلباتك وتنبيهاتك ومحادثاتك.' : 'Orders, alerts and conversations.'}</p></div>
      <button className="client-portal-refresh" type="button" onClick={load} aria-label={ar ? 'تحديث' : 'Refresh'}><RefreshCw className={loading ? 'spin' : ''} size={17}/></button>
    </div>

    <div className="client-portal-tabs">{tabs.map(([key, Icon, label, count]) => <button type="button" key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><Icon size={17}/><span>{label}</span>{count > 0 && <b>{count}</b>}</button>)}</div>

    {error && <div className="client-portal-alert"><CircleHelp size={16}/><span>{error}</span></div>}
    {loading ? <div className="client-portal-loading"><LoaderCircle className="spin" size={24}/><span>{ar ? 'جاري تحميل بيانات الحساب…' : 'Loading account data…'}</span></div> : <>
      {tab === 'notifications' && <div className="client-notification-feed">
        {notifications.length ? notifications.map(item => {
          const isRead = reads.has(item.id);
          return <button type="button" className={`client-notification-item ${isRead ? 'read' : 'unread'} ${item.type || 'info'}`} key={item.id} onClick={() => markRead(item.id)}>
            <span className="client-notification-mark"><BellRing size={17}/></span>
            <div><div><small>{item.type === 'offer' ? (ar ? 'عرض' : 'Offer') : item.type === 'warning' ? (ar ? 'تنبيه' : 'Alert') : (ar ? 'إشعار' : 'Notification')}</small>{!isRead && <em>{ar ? 'جديد' : 'New'}</em>}</div><strong>{ar ? item.title_ar : (item.title_en || item.title_ar)}</strong><p>{ar ? item.body_ar : (item.body_en || item.body_ar)}</p><time><Clock3 size={12}/>{fmt(item.published_at || item.created_at, lang)}</time></div>
            <Arrow size={16}/>
          </button>;
        }) : <Empty icon={BellRing} title={ar ? 'لا توجد إشعارات جديدة' : 'No notifications yet'} text={ar ? 'ستظهر هنا تحديثات الطلبات والعروض والتنبيهات المهمة.' : 'Order updates, offers and important notices will appear here.'}/>} 
      </div>}

      {tab === 'support' && <div className="client-support-area">
        {!selectedConversation ? <div className="client-conversation-list">{conversations.length ? conversations.map(item => <button type="button" key={item.id} onClick={() => openConversation(item)}><span className={`client-conversation-dot ${item.status}`}/><div><strong>{item.subject}</strong><small>{item.status === 'closed' ? (ar ? 'مغلقة' : 'Closed') : item.status === 'pending' ? (ar ? 'بانتظار المتابعة' : 'Pending') : (ar ? 'مفتوحة' : 'Open')} · {fmt(item.last_message_at, lang)}</small></div><Arrow size={16}/></button>) : <Empty icon={Inbox} title={ar ? 'ما عندك محادثات بعد' : 'No support conversations yet'} text={ar ? 'استخدم زر المساعدة العائم لفتح تذكرة مباشرة مع الإدارة.' : 'Use the floating Help button to open a tracked conversation with administration.'}/>}</div> : <div className="client-thread">
          <div className="client-thread-head"><button type="button" onClick={() => setSelectedConversation(null)}><Arrow size={17}/>{ar ? 'المحادثات' : 'Conversations'}</button><div><strong>{selectedConversation.subject}</strong><small>{selectedConversation.status}</small></div></div>
          <div className="client-thread-messages">{messages.map(msg => <article key={msg.id} className={msg.sender_role === 'admin' ? 'admin' : 'user'}><div>{msg.body}</div><time>{fmt(msg.created_at, lang)}</time></article>)}</div>
          {selectedConversation.status !== 'closed' ? <form className="client-thread-reply" onSubmit={sendReply}><textarea rows="2" value={reply} onChange={e => setReply(e.target.value)} placeholder={ar ? 'اكتب ردك للإدارة…' : 'Write your reply to administration…'} required/><button className="btn primary" disabled={sending}><Send size={15}/>{sending ? (ar ? 'إرسال…' : 'Sending…') : (ar ? 'إرسال' : 'Send')}</button></form> : <div className="client-thread-closed"><Check size={15}/>{ar ? 'تم إغلاق هذه المحادثة.' : 'This conversation is closed.'}</div>}
        </div>}
      </div>}

      {tab === 'orders' && <div className="client-order-list">{orders.length ? orders.map(order => <article key={order.id}><div><small>#{String(order.order_number).padStart(5, '0')}</small><strong>{orderLabels[lang]?.[order.status] || order.status}</strong></div><div><span>{sar(order.total, lang)}</span><time>{fmt(order.created_at, lang)}</time></div></article>) : <Empty icon={PackageSearch} title={ar ? 'لا توجد طلبات حتى الآن' : 'No orders yet'} text={ar ? 'عند إطلاق كتالوج المنتجات والطلبات ستظهر طلباتك هنا تلقائيًا.' : 'Your requests will appear here automatically once the client catalog launches.'}/>}</div>}
    </>}
  </section>;
}

function Empty({ icon: Icon, title, text }) {
  return <div className="client-portal-empty"><span><Icon size={24}/></span><strong>{title}</strong><p>{text}</p></div>;
}
