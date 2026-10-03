import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Bell, Check, CheckCheck, ChevronDown,
  ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Clock3, ExternalLink,
  Gift, Heart, HelpCircle, Home, LoaderCircle, MapPin, MessageCircleMore,
  PackageOpen, PackageSearch, PencilLine, Phone, RefreshCw, RotateCcw, Search,
  Send, ShieldCheck, ShoppingBag, Sparkles, Store, Tag, UserRound, X,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa6';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import { resolveProductPrice } from '../lib/storePricing';
import { whatsappHref } from '../lib/season-design';
import {
  ACTIVE_ORDER_STATUSES, COMPLETED_ORDER_STATUSES, EDITABLE_ORDER_STATUSES,
  addressText, fmtDate, fmtRelative, orderAddress, orderNo, productName,
  statusMeta,
} from './individualUtils';
import './individual-account.css';

const CATEGORY_COPY = {
  order_status: ['استفسار عن حالة الطلب', 'Order status'],
  change_address: ['تعديل عنوان الطلب', 'Change order address'],
  change_recipient_phone: ['تعديل رقم المستلم', 'Change recipient number'],
  gift_message: ['تعديل رسالة الإهداء', 'Edit gift message'],
  cancel_request: ['طلب إلغاء الطلب', 'Order cancellation request'],
  delivery_not_received: ['مشكلة في التسليم', 'Delivery issue'],
  product_issue: ['مشكلة في المنتج', 'Product issue'],
  product_change: ['طلب تغيير المنتجات', 'Product change request'],
  urgent_change: ['تعديل عاجل على الطلب', 'Urgent order change'],
  coupon: ['مشكلة في كوبون أو خصم', 'Coupon or discount issue'],
  general: ['مساعدة عامة', 'General help'],
};

function statusLabel(status, ar) {
  if (status === 'open') return ar ? 'بانتظار رد بلقيس' : 'Waiting for Balqees';
  if (status === 'pending') return ar ? 'بانتظار ردك' : 'Waiting for you';
  return ar ? 'تم الحل' : 'Resolved';
}
function clean(value = '') { return String(value || '').trim().toLowerCase(); }
function todayRiyadh() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function phoneText(value = '') { const digits = String(value || '').replace(/\D/g, ''); return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : value || '—'; }
function categoryTitle(category, ar) { return CATEGORY_COPY[category]?.[ar ? 0 : 1] || (ar ? 'مساعدة من فريق بلقيس' : 'Balqees Care'); }
function firstItem(order) { return order?.order_items?.[0] || null; }

function intentFromQuery(query) {
  const q = clean(query);
  if (!q) return null;
  const has = (...keys) => keys.some(key => q.includes(key));
  if (has('وين طلبي', 'اين طلبي', 'أين طلبي', 'حالة الطلب', 'تتبع', 'track', 'where is my order', 'order status')) return 'track_order';
  if (has('غير العنوان', 'غيّر العنوان', 'تغيير العنوان', 'عدل العنوان', 'تعديل العنوان', 'عنوان الطلب', 'change address', 'delivery address')) return 'change_address';
  if (has('رقم المستلم', 'رقم الجوال', 'غير الرقم', 'غيّر الرقم', 'تعديل الرقم', 'change number', 'recipient phone', 'phone number')) return 'change_phone';
  if (has('رسالة الإهداء', 'رسالة الهدية', 'اكتب الرسالة', 'gift message', 'gift note')) return 'gift_message';
  if (has('الغ الطلب', 'ألغي الطلب', 'الغاء الطلب', 'إلغاء الطلب', 'cancel order', 'cancel my order')) return 'cancel_order';
  if (has('ما وصل', 'لم يصل', 'تأخر الطلب', 'التوصيل اليوم', 'delivery', 'not arrived', 'late order')) return 'delivery_issue';
  if (has('ناقص', 'تالف', 'مختلف', 'مشكلة في المنتج', 'product issue', 'wrong product', 'damaged')) return 'product_issue';
  if (has('اعادة طلب', 'إعادة طلب', 'اطلبه مرة', 'كرر الطلب', 'repeat order', 'order again')) return 'repeat_order';
  if (has('كوبون', 'خصم', 'coupon', 'discount')) return 'coupon';
  if (has('هدية', 'اختار هدية', 'اختر هدية', 'gift', 'present')) return 'gift_help';
  if (has('عنواني', 'العناوين', 'address book', 'saved address')) return 'addresses';
  if (has('مفضلة', 'المفضلة', 'favorite', 'wishlist')) return 'favorites';
  if (has('سلة', 'cart')) return 'cart';
  return 'faq';
}

function SupportChrome({ lang, session, cartCount, unreadCount, children }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    document.body.classList.add('individual-account-active', 'individual-support-active');
    return () => document.body.classList.remove('individual-account-active', 'individual-support-active');
  }, []);
  useEffect(() => {
    if (!supabase || !session?.user?.id) return;
    supabase.from('customer_profiles').select('full_name').eq('id', session.user.id).maybeSingle().then(({ data }) => setProfile(data || null));
  }, [session?.user?.id]);
  const fullName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || (ar ? 'عميل بلقيس' : 'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];
  return <div className="individual-account-app individual-support-app" dir={ar ? 'rtl' : 'ltr'}>
    <header className="individual-topbar"><div className="individual-shell individual-topbar-inner">
      <Link to="/" className="individual-brand"><BrandMark/></Link>
      <div className="individual-topbar-center"><span>{ar ? 'مركز العناية' : 'BALQEES CARE'}</span><small>{ar ? 'حساب فردي' : 'INDIVIDUAL ACCOUNT'}</small></div>
      <div className="individual-top-actions">
        <button type="button" className="individual-icon-button" onClick={() => navigate('/account/notifications')} aria-label={ar ? 'الإشعارات' : 'Notifications'}><Bell size={19}/>{unreadCount > 0 && <b>{Math.min(unreadCount, 9)}</b>}</button>
        <button type="button" className="individual-icon-button" onClick={() => navigate('/account/cart')} aria-label={ar ? 'السلة' : 'Cart'}><ShoppingBag size={19}/>{cartCount > 0 && <b>{Math.min(cartCount, 99)}</b>}</button>
        <button type="button" className="individual-profile-chip" onClick={() => navigate('/account/profile')}><span>{fullName.slice(0,1).toUpperCase()}</span><div><small>{ar ? 'مرحبًا' : 'Welcome'}</small><strong>{firstName}</strong></div></button>
      </div>
    </div></header>
    {children}
    <nav className="individual-mobile-dock">
      <Link to="/account"><Home/><span>{ar ? 'الرئيسية' : 'Home'}</span></Link>
      <Link to="/account/orders"><PackageOpen/><span>{ar ? 'طلباتي' : 'Orders'}</span></Link>
      <Link to="/store"><Store/><span>{ar ? 'المتجر' : 'Store'}</span></Link>
      <Link to="/account/favorites"><Heart/><span>{ar ? 'المفضلة' : 'Favorites'}</span></Link>
      <Link className="active" to="/account/profile"><UserRound/><span>{ar ? 'حسابي' : 'Account'}</span></Link>
    </nav>
  </div>;
}

export default function IndividualSupport({ lang, session }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const cart = useBalqeesCart(session?.user?.id || null);
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationMeta, setConversationMeta] = useState({});
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [products, setProducts] = useState([]);
  const [priceRules, setPriceRules] = useState([]);
  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [query, setQuery] = useState('');
  const [faqQuery, setFaqQuery] = useState('');
  const [result, setResult] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [solutionAttempts, setSolutionAttempts] = useState([]);

  const activeOrder = useMemo(() => orders.find(row => ACTIVE_ORDER_STATUSES.has(row.status)) || null, [orders]);
  const completedOrder = useMemo(() => orders.find(row => COMPLETED_ORDER_STATUSES.has(row.status)) || null, [orders]);
  const productMap = useMemo(() => Object.fromEntries(products.map(item => [String(item.id), item])), [products]);
  const selectedMeta = selectedConversation ? conversationMeta[selectedConversation.id] || {} : {};

  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 3600); return () => window.clearTimeout(timer); }, [toast]);

  async function load(silent = false) {
    if (!supabase || !session?.user?.id) return;
    silent ? setRefreshing(true) : setLoading(true); setError('');
    const uid = session.user.id;
    const [orderRes, addressRes, faqRes, convRes, productRes, rulesRes, notifRes, readsRes] = await Promise.all([
      supabase.from('orders').select('*,order_items(*)').eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
      supabase.from('customer_addresses').select('*').eq('user_id', uid).eq('is_active', true).order('is_default', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('faq_items').select('*').eq('is_active', true).order('is_featured', { ascending: false }).order('sort_order').limit(80),
      supabase.from('support_conversations').select('*').eq('user_id', uid).order('last_message_at', { ascending: false }).limit(40),
      supabase.from('products').select('*').eq('visibility', 'public').eq('is_active', true),
      supabase.from('price_rules').select('*').eq('is_active', true),
      supabase.from('notifications').select('id,user_id,audience,status,category,expires_at').eq('status', 'published').order('published_at', { ascending: false }).limit(60),
      supabase.from('notification_reads').select('notification_id').eq('user_id', uid),
    ]);
    const major = [orderRes, addressRes, faqRes, convRes].find(x => x.error)?.error;
    if (major) setError(ar ? 'تعذر تحميل جزء من مركز العناية. جرّب التحديث.' : 'Part of Balqees Care could not be loaded. Please refresh.');
    const convs = convRes.data || [];
    const ids = convs.map(x => x.id);
    let meta = {};
    if (ids.length) {
      const { data: allMessages } = await supabase.from('support_messages').select('id,conversation_id,sender_role,body,read_at,created_at').in('conversation_id', ids).order('created_at', { ascending: false });
      (allMessages || []).forEach(msg => {
        const row = (meta[msg.conversation_id] ||= { unread: 0, last: null });
        if (!row.last) row.last = msg;
        if (msg.sender_role === 'admin' && !msg.read_at) row.unread += 1;
      });
    }
    const readSet = new Set((readsRes.data || []).map(x => x.notification_id));
    const now = Date.now();
    const unread = (notifRes.data || []).filter(item => {
      const audience = item.audience === 'all' || item.audience === 'individual' || (item.audience === 'user' && item.user_id === uid);
      return audience && (!item.expires_at || new Date(item.expires_at).getTime() >= now) && !readSet.has(item.id);
    }).length;
    setOrders(orderRes.data || []); setAddresses(addressRes.data || []); setFaqs(faqRes.data || []); setConversations(convs); setConversationMeta(meta); setProducts(productRes.data || []); setPriceRules(rulesRes.data || []); setNotificationsUnread(unread);
    setLoading(false); setRefreshing(false);
  }

  useEffect(() => { load(); }, [session?.user?.id]);

  useEffect(() => {
    const conversationId = params.get('conversation');
    if (conversationId && conversations.length) {
      const found = conversations.find(c => c.id === conversationId);
      if (found) openConversation(found, false);
    }
  }, [conversations.length]);

  useEffect(() => {
    const category = params.get('category');
    const orderId = params.get('order');
    const message = params.get('message');
    if (!category && !orderId && !message) return;
    const order = orders.find(x => String(x.id) === String(orderId)) || activeOrder;
    setResult({ type: 'escalate', category: category || 'general', order, preset: message || '', title: categoryTitle(category || 'general', ar) });
  }, [orders.length]);

  useEffect(() => {
    if (!supabase || !selectedConversation?.id) return undefined;
    const channel = supabase.channel(`care-${selectedConversation.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${selectedConversation.id}` }, () => {
      openConversation(selectedConversation, false); load(true);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConversation?.id]);

  const featuredFaqs = useMemo(() => {
    const selected = faqs.filter(x => x.is_featured).slice(0, 4);
    return selected.length ? selected : faqs.slice(0, 4);
  }, [faqs]);
  const faqMatches = useMemo(() => {
    const needle = clean(faqQuery || (result?.type === 'faq' ? result.query : ''));
    if (!needle) return [];
    return faqs.filter(item => clean(`${item.question_ar} ${item.question_en || ''} ${item.answer_ar} ${item.answer_en || ''} ${item.category || ''}`).includes(needle)).slice(0, 3);
  }, [faqs, faqQuery, result]);

  const quickActions = useMemo(() => {
    if (activeOrder) {
      const list = [
        { key: 'track_order', icon: PackageSearch, title: ar ? 'وين طلبي؟' : 'Where is my order?', note: statusMeta(activeOrder, lang).title },
        { key: 'change_address', icon: MapPin, title: ar ? 'تعديل العنوان' : 'Change address', note: ar ? 'إذا كانت المرحلة تسمح' : 'When the stage allows it' },
        { key: 'change_phone', icon: Phone, title: ar ? 'تغيير رقم المستلم' : 'Change recipient number', note: phoneText(activeOrder.recipient_snapshot?.phone) },
        { key: 'delivery_issue', icon: AlertTriangle, title: ar ? 'مشكلة في الطلب' : 'Order issue', note: activeOrder.requested_delivery_date === todayRiyadh() ? (ar ? 'التسليم اليوم' : 'Delivery is today') : (ar ? 'نراجعها معك' : 'We will review it with you') },
      ];
      if (activeOrder.is_gift) list.splice(3, 0, { key: 'gift_message', icon: Gift, title: ar ? 'رسالة الإهداء' : 'Gift message', note: ar ? 'تعديل قبل التجهيز' : 'Edit before fulfillment' });
      return list.slice(0, 5);
    }
    if (cart.count > 0) return [
      { key: 'cart', icon: ShoppingBag, title: ar ? 'إكمال السلة' : 'Continue my cart', note: ar ? `${cart.count} منتج بانتظارك` : `${cart.count} item${cart.count === 1 ? '' : 's'} waiting` },
      { key: 'coupon', icon: Tag, title: ar ? 'كوبون أو خصم' : 'Coupon or discount', note: ar ? 'نفحصه من السيرفر' : 'Validated on the server' },
      { key: 'addresses', icon: MapPin, title: ar ? 'العناوين والمستلمون' : 'Addresses & recipients', note: ar ? 'جهّز بيانات التوصيل' : 'Prepare delivery details' },
      { key: 'gift_help', icon: Gift, title: ar ? 'ساعدني أختار هدية' : 'Help me choose a gift', note: ar ? 'إذا كنت ما زلت تختار' : 'If you are still deciding' },
    ];
    return [
      { key: 'gift_help', icon: Gift, title: ar ? 'ساعدني أختار هدية' : 'Help me choose a gift', note: ar ? 'مناسبات وميزانيات' : 'Occasions and budgets' },
      { key: 'addresses', icon: MapPin, title: ar ? 'العناوين والمستلمون' : 'Addresses & recipients', note: ar ? 'إدارة بيانات التوصيل' : 'Manage delivery details' },
      { key: 'favorites', icon: Heart, title: ar ? 'المفضلة' : 'Favorites', note: ar ? 'ارجع لما حفظته' : 'Return to saved items' },
      { key: 'coupon', icon: Tag, title: ar ? 'كوبون أو خصم' : 'Coupon or discount', note: ar ? 'نفحص السلة أولًا' : 'Check the cart first' },
    ];
  }, [activeOrder, ar, lang, cart.count]);

  function logAttempt(action, outcome, details = {}) {
    setSolutionAttempts(list => [...list.slice(-5), { action, outcome, at: new Date().toISOString(), ...details }]);
  }

  function runIntent(intent, sourceQuery = '') {
    if (!intent) return;
    setSelectedConversation(null); setMessages([]);
    if (intent === 'track_order') {
      logAttempt(intent, activeOrder ? 'shown' : 'no_active_order');
      setResult(activeOrder ? { type: 'track', order: activeOrder } : { type: 'route', icon: PackageOpen, title: ar ? 'ما عندك طلب نشط الآن' : 'You have no active order right now', body: ar ? 'تقدر تشوف طلباتك السابقة أو تبدأ طلبًا جديدًا.' : 'You can review previous orders or start a new one.', action: () => navigate('/account/orders'), actionLabel: ar ? 'عرض طلباتي' : 'View my orders' });
      return;
    }
    if (intent === 'change_address') {
      if (!activeOrder) return setResult({ type: 'route', icon: MapPin, title: ar ? 'إدارة العناوين' : 'Manage addresses', body: ar ? 'ما عندك طلب نشط يحتاج تعديل عنوان. تقدر تضبط عناوينك المحفوظة الآن.' : 'There is no active order needing an address change. You can manage saved addresses now.', action: () => navigate('/account/addresses'), actionLabel: ar ? 'فتح العناوين' : 'Open addresses' });
      if (EDITABLE_ORDER_STATUSES.has(activeOrder.status)) { logAttempt(intent, 'self_service_available'); setResult({ type: 'address', order: activeOrder }); }
      else { logAttempt(intent, 'locked', { status: activeOrder.status }); setResult({ type: 'escalate', order: activeOrder, category: 'urgent_change', title: ar ? 'بدأ تجهيز الطلب' : 'Fulfillment has started', preset: ar ? 'أحتاج تعديل عنوان الطلب بعد بدء التنفيذ.' : 'I need to change the delivery address after fulfillment started.', explanation: ar ? 'التعديل المباشر غير متاح في هذه المرحلة. نقدر نرسل الحالة لفريق بلقيس ومعها رقم الطلب وحالته الحالية.' : 'Direct editing is no longer available at this stage. We can send the case to Balqees Care with the order context.' }); }
      return;
    }
    if (intent === 'change_phone') {
      if (!activeOrder) return setResult({ type: 'route', icon: UserRound, title: ar ? 'المستلمون' : 'Recipients', body: ar ? 'عدّل بيانات المستلمين المحفوظين من صفحة العناوين والمستلمين.' : 'Manage saved recipient details from Addresses & Recipients.', action: () => navigate('/account/addresses?tab=recipients'), actionLabel: ar ? 'فتح المستلمين' : 'Open recipients' });
      if (EDITABLE_ORDER_STATUSES.has(activeOrder.status)) { logAttempt(intent, 'self_service_available'); setResult({ type: 'phone', order: activeOrder, value: activeOrder.recipient_snapshot?.phone || '' }); }
      else { logAttempt(intent, 'locked', { status: activeOrder.status }); setResult({ type: 'escalate', order: activeOrder, category: 'urgent_change', title: ar ? 'رقم المستلم يحتاج تدخل الفريق' : 'Recipient number needs team help', preset: ar ? 'أحتاج تعديل رقم تواصل المستلم بعد بدء التنفيذ.' : 'I need to change the recipient contact number after fulfillment started.' }); }
      return;
    }
    if (intent === 'gift_message') {
      if (!activeOrder?.is_gift) return setResult({ type: 'route', icon: Gift, title: ar ? 'هذا الطلب ليس مسجلًا كهدية' : 'This order is not marked as a gift', body: ar ? 'إذا تحتاج إضافة شيء خاص للطلب، تواصل معنا بخصوص الطلب.' : 'If you need a special change, contact us about the order.', action: () => runIntent('delivery_issue'), actionLabel: ar ? 'مساعدة في الطلب' : 'Order help' });
      if (EDITABLE_ORDER_STATUSES.has(activeOrder.status)) { logAttempt(intent, 'self_service_available'); setResult({ type: 'gift_message', order: activeOrder, value: activeOrder.gift_message || '' }); }
      else { logAttempt(intent, 'locked'); setResult({ type: 'escalate', order: activeOrder, category: 'urgent_change', title: ar ? 'بدأ تجهيز الطلب' : 'Fulfillment has started', preset: ar ? 'أحتاج تعديل رسالة الإهداء بعد بدء التجهيز.' : 'I need to edit the gift message after fulfillment started.' }); }
      return;
    }
    if (intent === 'cancel_order') {
      if (!activeOrder) return setResult({ type: 'route', icon: PackageOpen, title: ar ? 'لا يوجد طلب نشط للإلغاء' : 'No active order to cancel', body: ar ? 'راجع طلباتك إذا كنت تقصد طلبًا سابقًا.' : 'Review your orders if you mean an older order.', action: () => navigate('/account/orders'), actionLabel: ar ? 'طلباتي' : 'My orders' });
      logAttempt(intent, 'human_required', { status: activeOrder.status });
      setResult({ type: 'escalate', order: activeOrder, category: 'cancel_request', title: ar ? 'طلب الإلغاء يحتاج مراجعة' : 'Cancellation needs review', preset: ar ? 'أرغب في طلب إلغاء هذا الطلب.' : 'I would like to request cancellation of this order.', explanation: ar ? 'الإلغاء لا ينفذ آليًا من مركز العناية. سنرسل الطلب لفريق بلقيس مع حالة الطلب الحالية.' : 'Cancellation is not performed automatically by Balqees Care. We will send the request with the current order status.' });
      return;
    }
    if (intent === 'delivery_issue' || intent === 'product_issue') {
      const category = intent === 'delivery_issue' ? 'delivery_not_received' : 'product_issue';
      logAttempt(intent, 'human_required');
      setResult({ type: 'escalate', order: activeOrder, category, title: intent === 'delivery_issue' ? (ar ? 'خلنا نراجع التسليم' : 'Let’s review delivery') : (ar ? 'خلنا نراجع المنتج' : 'Let’s review the product'), preset: sourceQuery || (intent === 'delivery_issue' ? (ar ? 'عندي مشكلة في تسليم الطلب.' : 'I have an issue with order delivery.') : (ar ? 'عندي مشكلة في المنتج المستلم.' : 'I have an issue with the received product.')) });
      return;
    }
    if (intent === 'repeat_order') { logAttempt(intent, completedOrder ? 'available' : 'no_completed_order'); setResult(completedOrder ? { type: 'repeat', order: completedOrder } : { type: 'route', icon: RotateCcw, title: ar ? 'ما عندك طلب مكتمل لإعادته الآن' : 'No completed order is available to repeat', body: ar ? 'تقدر تبدأ من المتجر أو تراجع سجل طلباتك.' : 'Start from the store or review your order history.', action: () => navigate('/account/orders'), actionLabel: ar ? 'عرض الطلبات' : 'View orders' }); return; }
    if (intent === 'coupon') { setResult({ type: 'route', icon: Tag, title: ar ? 'خلنا نراجع الكوبون داخل السلة' : 'Let’s check the coupon in your cart', body: ar ? 'السلة تتحقق من الكود من السيرفر وتوضح لك إذا انتهى، غير فعال، أو يحتاج حدًا أدنى.' : 'The cart validates coupons on the server and explains expiry, invalid codes, or minimum order requirements.', action: () => navigate('/account/cart'), actionLabel: ar ? 'فتح السلة' : 'Open cart' }); return; }
    if (intent === 'gift_help') { setResult({ type: 'route', icon: Gift, title: ar ? 'مساعد المناسبات أنسب مكان' : 'Occasion assistant is the best place', body: ar ? 'حدد المناسبة والميزانية ونوع الهدية، ويعرض لك خيارات قليلة من المنتجات الحقيقية.' : 'Choose the occasion, budget and gift type to get a few real catalog options.', action: () => navigate('/account/occasions'), actionLabel: ar ? 'ساعدني أختار' : 'Help me choose' }); return; }
    if (intent === 'addresses') { navigate('/account/addresses'); return; }
    if (intent === 'favorites') { navigate('/account/favorites'); return; }
    if (intent === 'cart') { navigate('/account/cart'); return; }
    setResult({ type: 'faq', query: sourceQuery }); setFaqQuery(sourceQuery);
  }

  function submitSearch(e) { e?.preventDefault?.(); const text = query.trim(); if (!text) return; runIntent(intentFromQuery(text), text); }

  async function saveDirect(action, payload) {
    const order = result?.order;
    if (!order) return;
    if (action === 'recipient_phone') {
      const digits = String(payload?.text || '').replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 15) return setToast(ar ? 'اكتب رقم تواصل صحيحًا قبل الحفظ.' : 'Enter a valid contact number before saving.');
    }
    setSending(true);
    const { error: rpcError } = await supabase.rpc('customer_update_order_safe', {
      p_order_id: order.id, p_action: action, p_address_id: payload?.addressId || null, p_recipient_id: null, p_text: payload?.text ?? null,
    });
    setSending(false);
    if (rpcError) {
      const locked = String(rpcError.message || '').includes('ORDER_LOCKED');
      logAttempt(action, locked ? 'locked_during_save' : 'failed');
      if (locked) return setResult({ type: 'escalate', order, category: 'urgent_change', title: ar ? 'تغيرت مرحلة الطلب' : 'Order stage changed', preset: ar ? 'حاولت تعديل الطلب من مركز العناية، لكن بدأ التنفيذ قبل الحفظ.' : 'I tried to update the order in Balqees Care, but fulfillment started before the change was saved.' });
      return setToast(ar ? 'تعذر حفظ التعديل الآن.' : 'Could not save this change right now.');
    }
    logAttempt(action, 'completed'); setToast(ar ? 'تم التعديل وتسجيله على الطلب.' : 'The change was saved and recorded on the order.'); await load(true); setResult(null);
  }

  function repeatLatestOrder() {
    const order = result?.order;
    if (!order) return;
    let added = 0, unavailable = 0, changed = 0;
    (order.order_items || []).forEach(item => {
      const product = productMap[String(item.product_id)];
      const canUse = product && product.is_active !== false && product.visibility === 'public' && (product.stock_mode !== 'tracked' || Number(product.stock_quantity || 0) >= Number(item.quantity || 1));
      if (!canUse) { unavailable += 1; return; }
      const effective = resolveProductPrice(product, priceRules).effective;
      if (!product.price_on_request && Math.abs(Number(effective || 0) - Number(item.unit_price || 0)) > .009) changed += 1;
      cart.add(product, Number(item.quantity || 1), { unit_price_snapshot: effective }); added += 1;
    });
    logAttempt('repeat_order', added ? 'added_to_cart' : 'unavailable', { added, unavailable, changed });
    if (!added) return setToast(ar ? 'منتجات الطلب غير متاحة حاليًا؛ نفتح لك المتجر لاختيار بدائل.' : 'The order items are not currently available; browse the store for alternatives.');
    setToast(ar ? `أضفنا ${added} للسلة${unavailable ? `، و${unavailable} غير متاح` : ''}${changed ? `، و${changed} بسعر محدث` : ''}.` : `Added ${added} to cart${unavailable ? `; ${unavailable} unavailable` : ''}${changed ? `; ${changed} with updated pricing` : ''}.`);
    window.setTimeout(() => navigate('/account/cart'), 180);
  }

  async function ensureConversation({ category = 'general', order = null, title, preset = '' }) {
    const context = order ? {
      source: 'balqees_smart_care', order_id: order.id, order_number: order.order_number, order_status: order.status,
      requested_delivery_date: order.requested_delivery_date || null,
      recipient_phone_last4: String(order.recipient_snapshot?.phone || '').replace(/\D/g,'').slice(-4) || null,
      address_summary: addressText(orderAddress(order), ar, true) || null,
    } : { source: 'balqees_smart_care' };
    const { data, error: openError } = await supabase.rpc('customer_open_support_case', {
      p_order_id: order?.id || null,
      p_category: category,
      p_subject: title || categoryTitle(category, ar),
      p_automation_attempts: solutionAttempts,
      p_context_snapshot: context,
    });
    if (openError || !data?.id) return { error: openError || new Error('CASE_CREATE_FAILED') };
    const conversation = {
      id: data.id, user_id: session.user.id, order_id: data.order_id || order?.id || null,
      category: data.category || category, subject: data.subject || title || categoryTitle(category, ar),
      status: data.status || 'open', priority: data.priority || 'normal',
    };
    return { conversation, preset };
  }

  async function sendEscalation() {
    if (!result || result.type !== 'escalate') return;
    const text = (result.message ?? result.preset ?? '').trim();
    if (!text) return setToast(ar ? 'اكتب سطرًا يوضح طلبك للفريق.' : 'Write a short note for the team.');
    setSending(true);
    const { conversation, error: convError } = await ensureConversation({ category: result.category || 'general', order: result.order || null, title: result.title, preset: text });
    if (convError || !conversation) { setSending(false); return setToast(ar ? 'تعذر إنشاء الحالة الآن.' : 'Could not create the case right now.'); }
    const { error: messageError } = await supabase.from('support_messages').insert({ conversation_id: conversation.id, sender_id: session.user.id, sender_role: 'user', body: text });
    setSending(false);
    if (messageError) return setToast(ar ? 'تعذر إرسال الرسالة الآن.' : 'Could not send the message right now.');
    logAttempt('human_handoff', 'sent', { conversation_id: conversation.id });
    setToast(ar ? 'وصلت الحالة لفريق بلقيس بكل السياق.' : 'The case reached Balqees Care with its context.');
    await load(true); await openConversation({ ...conversation, status: 'open' }, true); setResult(null);
  }

  async function openConversation(conversation, syncParams = true) {
    if (!conversation || !supabase) return;
    setResult(null); setMessages([]);
    if (syncParams) setParams({ conversation: conversation.id });
    const [{ data: fresh }, { data }] = await Promise.all([
      supabase.from('support_conversations').select('*').eq('id', conversation.id).eq('user_id', session.user.id).maybeSingle(),
      supabase.from('support_messages').select('*').eq('conversation_id', conversation.id).order('created_at', { ascending: true }),
    ]);
    setSelectedConversation(fresh || conversation);
    setMessages(data || []);
    try { await supabase.rpc('customer_mark_support_read', { p_conversation_id: conversation.id }); } catch { /* best effort */ }
    setConversationMeta(meta => ({ ...meta, [conversation.id]: { ...(meta[conversation.id] || {}), unread: 0 } }));
  }

  async function sendReply() {
    if (!selectedConversation || !reply.trim()) return;
    setSending(true);
    if (selectedConversation.status === 'closed') {
      const { error: reopenError } = await supabase.rpc('customer_reopen_support', { p_conversation_id: selectedConversation.id });
      if (reopenError) { setSending(false); return setToast(ar ? 'تعذر إعادة فتح المحادثة.' : 'Could not reopen the conversation.'); }
    }
    const { error: sendError } = await supabase.from('support_messages').insert({ conversation_id: selectedConversation.id, sender_id: session.user.id, sender_role: 'user', body: reply.trim() });
    setSending(false);
    if (sendError) return setToast(ar ? 'تعذر إرسال الرسالة.' : 'Could not send the message.');
    setReply(''); await load(true); await openConversation({ ...selectedConversation, status: 'open' }, false);
  }

  async function closeConversation() {
    if (!selectedConversation) return;
    const { error: closeError } = await supabase.rpc('customer_close_support', { p_conversation_id: selectedConversation.id });
    if (closeError) return setToast(ar ? 'تعذر إغلاق المحادثة الآن.' : 'Could not close the conversation.');
    setToast(ar ? 'تم تسجيل أن المشكلة حُلّت.' : 'The issue was marked as resolved.');
    const next = { ...selectedConversation, status: 'closed' }; setSelectedConversation(next); await load(true);
  }

  async function reopenConversation() {
    if (!selectedConversation) return;
    const { error: reopenError } = await supabase.rpc('customer_reopen_support', { p_conversation_id: selectedConversation.id });
    if (reopenError) return setToast(ar ? 'تعذر إعادة فتح المحادثة.' : 'Could not reopen the conversation.');
    setSelectedConversation({ ...selectedConversation, status: 'open' }); await load(true);
  }

  function whatsappMessage() {
    if (selectedConversation?.order_id) {
      const order = orders.find(x => x.id === selectedConversation.order_id);
      return ar ? `السلام عليكم، أحتاج مساعدة من فريق بلقيس بخصوص الطلب ${order ? orderNo(order) : ''}.` : `Hello, I need help from Balqees Care about order ${order ? orderNo(order) : ''}.`;
    }
    if (activeOrder) return ar ? `السلام عليكم، أحتاج مساعدة من فريق بلقيس بخصوص الطلب ${orderNo(activeOrder)}.` : `Hello, I need help from Balqees Care about order ${orderNo(activeOrder)}.`;
    return ar ? 'السلام عليكم، أحتاج مساعدة من فريق بلقيس.' : 'Hello, I need help from Balqees Care.';
  }

  const currentOrderItem = firstItem(activeOrder);
  const resultOrderMeta = result?.order ? statusMeta(result.order, lang) : null;
  const selectedOrder = selectedConversation?.order_id ? orders.find(x => x.id === selectedConversation.order_id) : null;

  return <SupportChrome lang={lang} session={session} cartCount={cart.count} unreadCount={notificationsUnread}>
    <main className="individual-support-main"><div className="individual-shell">
      <section className="individual-support-head">
        <div><span className="individual-overline"><Sparkles size={14}/>{ar ? 'BALQEES SMART CARE' : 'BALQEES SMART CARE'}</span><h1>{ar ? 'كيف نقدر نساعدك؟' : 'How can we help?'}</h1><p>{ar ? 'نحاول نحل الموضوع مباشرة أولًا، ونوصل الحالة لفريق بلقيس فقط إذا احتاجت تدخلًا بشريًا.' : 'We try to solve the issue directly first, and involve Balqees Care only when human help is actually needed.'}</p></div>
        <button type="button" className="individual-support-refresh" onClick={() => load(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={16}/>{ar ? 'تحديث' : 'Refresh'}</button>
      </section>

      {error && <div className="individual-support-error"><CircleAlert size={17}/><span>{error}</span><button onClick={() => load(true)}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></div>}

      <form className="individual-support-search" onSubmit={submitSearch}>
        <Search size={20}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? 'اكتب بطريقتك: وين طلبي؟ أبغا أغير العنوان…' : 'Type naturally: where is my order? I need to change the address…'}/><button type="submit">{ar ? 'ساعدني' : 'Help me'}<ArrowRight size={15}/></button>
      </form>

      {activeOrder && !selectedConversation && <section className="individual-support-current-order">
        <div className="individual-support-current-order-image">{currentOrderItem?.product_snapshot?.image_url ? <img src={currentOrderItem.product_snapshot.image_url} alt=""/> : <PackageOpen size={26}/>}</div>
        <div><small>{ar ? 'هل استفسارك عن طلبك الحالي؟' : 'IS THIS ABOUT YOUR CURRENT ORDER?'}</small><h2>{orderNo(activeOrder)} · {statusMeta(activeOrder, lang).title}</h2><p>{currentOrderItem ? productName(currentOrderItem.product_snapshot, ar) : (ar ? 'طلب بلقيس الحالي' : 'Current Balqees order')}{activeOrder.requested_delivery_date ? ` · ${fmtDate(activeOrder.requested_delivery_date, lang)}` : ''}</p></div>
        <div><button className="primary" type="button" onClick={() => runIntent('track_order')}>{ar ? 'نعم، هذا الطلب' : 'Yes, this order'}</button><button type="button" onClick={() => setResult(null)}>{ar ? 'موضوع آخر' : 'Another topic'}</button></div>
      </section>}

      {!selectedConversation && <section className="individual-support-quick"><div className="individual-section-heading"><div><span>{ar ? 'حلول سريعة حسب حسابك' : 'QUICK SOLUTIONS FOR YOUR ACCOUNT'}</span><h2>{ar ? 'جرّب الحل المباشر أولًا' : 'Try the direct solution first'}</h2></div></div><div className="individual-support-quick-grid">{quickActions.map(item => { const Icon=item.icon; return <button key={item.key} type="button" onClick={() => runIntent(item.key)}><span><Icon size={19}/></span><div><strong>{item.title}</strong><small>{item.note}</small></div><ChevronLeft size={16}/></button>; })}</div></section>}

      {result && !selectedConversation && <section className="individual-support-result">
        {result.type === 'track' && <><div className="individual-support-result-title"><span><PackageSearch/></span><div><small>{ar ? 'الحالة الآن' : 'CURRENT STATUS'}</small><h2>{orderNo(result.order)} · {statusMeta(result.order, lang).title}</h2><p>{statusMeta(result.order, lang).desc}</p></div></div><div className="individual-support-order-facts"><div><span>{ar ? 'آخر تحديث' : 'Last update'}</span><strong>{fmtRelative(result.order.last_status_at || result.order.updated_at, lang)}</strong></div><div><span>{ar ? 'الخطوة التالية' : 'Next step'}</span><strong>{statusMeta(result.order, lang).next}</strong></div><div><span>{ar ? 'العنوان' : 'Address'}</span><strong>{addressText(orderAddress(result.order), ar, true) || (ar ? 'غير مكتمل' : 'Incomplete')}</strong></div></div><div className="individual-support-result-actions"><button className="primary" onClick={() => navigate(`/account/orders/${result.order.id}`)}>{ar ? 'عرض الطلب بالكامل' : 'View full order'}<ArrowRight size={15}/></button><button onClick={() => setResult(null)}>{ar ? 'تم، شكرًا' : 'Done, thanks'}</button></div></>}

        {result.type === 'address' && <><div className="individual-support-result-title"><span><MapPin/></span><div><small>{ar ? 'أصلحها لي' : 'FIX IT FOR ME'}</small><h2>{ar ? 'اختر عنوانًا آخر للطلب' : 'Choose another delivery address'}</h2><p>{ar ? `العنوان الحالي: ${addressText(orderAddress(result.order), ar, true) || 'غير مكتمل'}` : `Current address: ${addressText(orderAddress(result.order), ar, true) || 'Incomplete'}`}</p></div></div><div className="individual-support-choice-list">{addresses.length ? addresses.map(address => <button type="button" key={address.id} disabled={sending || address.id === result.order.customer_address_id} onClick={() => saveDirect('address', { addressId: address.id })}><MapPin size={17}/><div><strong>{address.label || (ar ? 'عنوان محفوظ' : 'Saved address')}</strong><span>{addressText(address, ar)}</span></div>{address.id === result.order.customer_address_id ? <Check size={16}/> : <ChevronLeft size={16}/>}</button>) : <div className="individual-support-inline-empty"><MapPin/><strong>{ar ? 'ما عندك عناوين محفوظة بعد' : 'No saved addresses yet'}</strong><button onClick={() => navigate('/account/addresses')}>{ar ? 'إضافة عنوان' : 'Add address'}</button></div>}</div></>}

        {result.type === 'phone' && <SupportInlineEdit icon={Phone} title={ar ? 'تعديل رقم تواصل المستلم' : 'Change recipient contact number'} description={ar ? 'يُحدّث الرقم لهذا الطلب فقط، بدون تغيير بطاقة المستلم المحفوظة.' : 'This updates the number for this order only, without changing the saved recipient card.'} value={result.value} setValue={value => setResult(v => ({ ...v, value }))} placeholder="05xxxxxxxx" sending={sending} onSave={() => saveDirect('recipient_phone', { text: result.value })} ar={ar}/>} 
        {result.type === 'gift_message' && <SupportInlineEdit icon={Gift} title={ar ? 'تعديل رسالة الإهداء' : 'Edit gift message'} description={ar ? 'راجع النص قبل الحفظ؛ سنسجل التغيير في سجل الطلب.' : 'Review the message before saving; the change will be recorded in the order history.'} value={result.value} setValue={value => setResult(v => ({ ...v, value }))} multiline sending={sending} onSave={() => saveDirect('gift_message', { text: result.value })} ar={ar}/>} 

        {result.type === 'repeat' && <><div className="individual-support-result-title"><span><RotateCcw/></span><div><small>{ar ? 'حل مباشر' : 'DIRECT SOLUTION'}</small><h2>{ar ? `إعادة الطلب ${orderNo(result.order)}` : `Repeat ${orderNo(result.order)}`}</h2><p>{ar ? 'سنضيف المنتجات المتاحة للسلة بالسعر والتوفر الحاليين، ولن ننشئ الطلب مباشرة.' : 'Available items will be added to the cart using current price and availability; no order is created automatically.'}</p></div></div><div className="individual-support-result-actions"><button className="primary" onClick={repeatLatestOrder}>{ar ? 'أضف للسلة للمراجعة' : 'Add to cart for review'}<ShoppingBag size={15}/></button><button onClick={() => navigate('/account/orders')}>{ar ? 'اختر طلبًا آخر' : 'Choose another order'}</button></div></>}

        {result.type === 'route' && <><div className="individual-support-result-title"><span><DynamicIcon icon={result.icon}/></span><div><small>{ar ? 'الحل الأقصر' : 'FASTEST SOLUTION'}</small><h2>{result.title}</h2><p>{result.body}</p></div></div><div className="individual-support-result-actions"><button className="primary" onClick={result.action}>{result.actionLabel}<ArrowRight size={15}/></button><button onClick={() => setResult(null)}>{ar ? 'رجوع' : 'Back'}</button></div></>}

        {result.type === 'faq' && <><div className="individual-support-result-title"><span><HelpCircle/></span><div><small>{ar ? 'بحث في معرفة بلقيس' : 'SEARCH BALQEES KNOWLEDGE'}</small><h2>{ar ? 'يمكن تكون الإجابة عندنا مباشرة' : 'The answer may already be here'}</h2><p>{ar ? 'نعرض فقط الإجابات الفعلية الموجودة في مركز المساعدة.' : 'We only show actual answers already saved in the help center.'}</p></div></div>{faqMatches.length ? <div className="individual-support-faq-results">{faqMatches.map(item => <FaqRow key={item.id} item={item} ar={ar}/>)}</div> : <div className="individual-support-no-answer"><HelpCircle/><strong>{ar ? 'ما لقينا إجابة محفوظة تطابق سؤالك' : 'No saved answer matched your question'}</strong><p>{ar ? 'نقدر الآن إرسال سؤالك لفريق بلقيس بدل اختراع إجابة.' : 'We can send your question to Balqees Care instead of inventing an answer.'}</p><button className="primary" onClick={() => setResult({ type: 'escalate', category: 'general', title: ar ? 'استفسار من مركز العناية' : 'Balqees Care question', preset: query || faqQuery })}>{ar ? 'تواصل مع فريق بلقيس' : 'Contact Balqees Care'}</button></div>}</>}

        {result.type === 'escalate' && <><div className="individual-support-result-title human"><span><MessageCircleMore/></span><div><small>{ar ? 'التحويل البشري — عند الحاجة فقط' : 'HUMAN HANDOFF — ONLY WHEN NEEDED'}</small><h2>{result.title}</h2><p>{result.explanation || (ar ? 'سنرسل الحالة مع سياق الطلب وما جربه مركز العناية حتى ما تبدأ من الصفر.' : 'We will send the case with order context and what Balqees Care already tried, so you do not start from zero.')}</p></div></div>{result.order && <div className="individual-support-handoff-context"><span>{orderNo(result.order)}</span><b>{statusMeta(result.order, lang).title}</b><small>{addressText(orderAddress(result.order), ar, true) || '—'}</small></div>}{solutionAttempts.length > 0 && <div className="individual-support-attempts"><small>{ar ? 'جربنا التالي' : 'WHAT WE TRIED'}</small>{solutionAttempts.slice(-3).map((item, i) => <span key={`${item.at}-${i}`}><Check size={12}/>{ar ? ({track_order:'تحققنا من حالة الطلب',change_address:'فحصنا إمكانية تعديل العنوان',change_phone:'فحصنا إمكانية تعديل رقم المستلم',gift_message:'فحصنا إمكانية تعديل رسالة الإهداء',cancel_order:'راجعنا مرحلة الطلب'}[item.action] || 'تم فحص المسار المناسب') : ({track_order:'Checked order status',change_address:'Checked address edit availability',change_phone:'Checked recipient number edit availability',gift_message:'Checked gift message edit availability',cancel_order:'Reviewed the order stage'}[item.action] || 'Checked the appropriate path')}</span>)}</div>}<label className="individual-support-handoff-message"><span>{ar ? 'رسالتك للفريق' : 'Your note to the team'}</span><textarea rows="4" value={result.message ?? result.preset ?? ''} onChange={e => setResult(v => ({ ...v, message: e.target.value }))} placeholder={ar ? 'اكتب أي تفصيل إضافي يحتاجه الفريق…' : 'Add any detail the team should know…'}/></label><div className="individual-support-result-actions"><button className="primary" disabled={sending} onClick={sendEscalation}>{sending ? <LoaderCircle className="spin"/> : <Send/>}{ar ? 'إرسال الحالة لفريق بلقيس' : 'Send case to Balqees Care'}</button><button onClick={() => setResult(null)}>{ar ? 'رجوع' : 'Back'}</button></div></>}
      </section>}

      {!result && !selectedConversation && <>
        <section className="individual-support-conversations"><div className="individual-section-heading"><div><span>{ar ? 'سجل واضح بدون تذاكر معقدة' : 'A CLEAR SUPPORT HISTORY'}</span><h2>{ar ? 'محادثاتي مع فريق بلقيس' : 'My conversations with Balqees Care'}</h2></div></div>{loading ? <div className="individual-support-loading"><LoaderCircle className="spin"/><span>{ar ? 'جاري تحميل مركز العناية…' : 'Loading Balqees Care…'}</span></div> : conversations.length ? <div className="individual-support-conversation-list">{conversations.map(c => { const meta=conversationMeta[c.id]||{}; const order=orders.find(x=>x.id===c.order_id); return <button type="button" key={c.id} onClick={() => openConversation(c)} className={meta.unread ? 'unread' : ''}><span className={`individual-support-status-dot ${c.status}`}/><div><div><strong>{c.subject}</strong><time>{fmtRelative(c.last_message_at, lang)}</time></div><p>{meta.last?.body || (ar ? 'افتح المحادثة لمشاهدة التفاصيل.' : 'Open the conversation to view details.')}</p><footer><em className={`status-${c.status}`}>{statusLabel(c.status, ar)}</em>{order && <span>{orderNo(order)}</span>}{meta.unread > 0 && <b>{meta.unread}</b>}</footer></div><ChevronLeft size={16}/></button>; })}</div> : <div className="individual-support-empty-conversations"><MessageCircleMore/><strong>{ar ? 'ما عندك محادثات دعم مفتوحة' : 'No support conversations yet'}</strong><p>{ar ? 'هذا شيء جيد. وإذا احتجت مساعدة، نبدأ دائمًا بالحل المباشر.' : 'That is a good thing. If you need help, we always start with a direct solution.'}</p></div>}</section>

        {faqs.length > 0 && <section className="individual-support-faq"><div className="individual-section-heading"><div><span>{ar ? 'بحث أولًا، وليس 30 سؤالًا مفتوحًا' : 'SEARCH FIRST, NOT A 30-QUESTION LIST'}</span><h2>{ar ? 'الأسئلة الشائعة' : 'Frequently asked questions'}</h2></div></div><div className="individual-support-faq-search"><Search size={16}/><input value={faqQuery} onChange={e => setFaqQuery(e.target.value)} placeholder={ar ? 'مثال: التوصيل، التعديل، الكوبون…' : 'Example: delivery, changes, coupon…'}/>{faqQuery && <button onClick={() => setFaqQuery('')}><X size={14}/></button>}</div><div className="individual-support-faq-list">{(faqQuery ? faqMatches : featuredFaqs).map(item => <FaqRow key={item.id} item={item} ar={ar}/>)}{faqQuery && !faqMatches.length && <div className="individual-support-inline-empty"><HelpCircle/><strong>{ar ? 'لا توجد إجابة مطابقة محفوظة' : 'No matching saved answer'}</strong><button onClick={() => setResult({ type:'escalate', category:'general', title:ar?'استفسار من مركز العناية':'Balqees Care question', preset:faqQuery })}>{ar ? 'اسأل فريق بلقيس' : 'Ask Balqees Care'}</button></div>}</div></section>}

        <section className="individual-support-secondary"><div><FaWhatsapp/><div><strong>{ar ? 'تحتاج تتواصل خارج الموقع؟' : 'Need to continue outside the website?'}</strong><p>{ar ? 'واتساب خيار ثانوي. الأفضل للحالات المرتبطة بالطلبات أن تبقى داخل الحساب حتى يظل السياق محفوظًا.' : 'WhatsApp is a secondary option. Order-related cases are better kept in your account so the context stays attached.'}</p></div></div><a href={whatsappHref(whatsappMessage())} target="_blank" rel="noreferrer">{ar ? 'فتح واتساب' : 'Open WhatsApp'}<ExternalLink size={14}/></a></section>
      </>}

      {selectedConversation && <section className="individual-support-chat">
        <header><button type="button" onClick={() => { setSelectedConversation(null); setMessages([]); setParams({}); }}><ChevronRight size={17}/>{ar ? 'المحادثات' : 'Conversations'}</button><div><small>{statusLabel(selectedConversation.status, ar)}</small><h2>{selectedConversation.subject}</h2>{selectedOrder && <p>{orderNo(selectedOrder)} · {statusMeta(selectedOrder, lang).title}</p>}</div><span className={`individual-support-chat-status ${selectedConversation.status}`}>{statusLabel(selectedConversation.status, ar)}</span></header>
        {selectedOrder && <div className="individual-support-chat-order"><PackageOpen size={17}/><div><strong>{orderNo(selectedOrder)} · {statusMeta(selectedOrder, lang).title}</strong><span>{addressText(orderAddress(selectedOrder), ar, true) || (ar ? 'العنوان غير مكتمل' : 'Address incomplete')}</span></div><button onClick={() => navigate(`/account/orders/${selectedOrder.id}`)}>{ar ? 'عرض الطلب' : 'View order'}</button></div>}
        <div className="individual-support-chat-messages">{messages.map(msg => <div className={`individual-support-chat-message ${msg.sender_role}`} key={msg.id}><small>{msg.sender_role === 'admin' ? (ar ? 'فريق بلقيس' : 'Balqees Care') : msg.sender_role === 'system' ? (ar ? 'النظام' : 'System') : (ar ? 'أنت' : 'You')}</small><p>{msg.body}</p><time>{fmtDate(msg.created_at, lang, true)}</time></div>)}{!messages.length && <div className="individual-support-chat-empty"><MessageCircleMore/><span>{ar ? 'لا توجد رسائل بعد.' : 'No messages yet.'}</span></div>}</div>
        <footer>{selectedConversation.status === 'closed' ? <div className="individual-support-chat-closed"><CircleCheck/><div><strong>{ar ? 'تم حل المشكلة' : 'Issue resolved'}</strong><span>{ar ? 'إذا رجعت لنفس الموضوع، أعد فتح نفس المحادثة بدل إنشاء واحدة جديدة.' : 'If the same issue returns, reopen this conversation instead of creating another one.'}</span></div><button onClick={reopenConversation}>{ar ? 'إعادة فتح المحادثة' : 'Reopen conversation'}</button></div> : <>{messages.filter(m => m.sender_role === 'user').length <= 1 && <div className="individual-support-smart-replies">{(selectedOrder ? [ar ? 'أريد تعديل العنوان' : 'I want to change the address', ar ? 'هل يمكن تقديم موعد الطلب؟' : 'Can the delivery be earlier?', ar ? 'أريد إضافة ملاحظة' : 'I want to add a note', ar ? 'أحتاج مساعدة في الطلب' : 'I need help with the order'] : [ar ? 'أحتاج مساعدة في حسابي' : 'I need help with my account', ar ? 'عندي استفسار عن التوصيل' : 'I have a delivery question']).map(text => <button type="button" key={text} onClick={() => setReply(text)}>{text}</button>)}</div>}<div className="individual-support-chat-composer"><textarea rows="2" value={reply} onChange={e => setReply(e.target.value)} placeholder={ar ? 'اكتب رسالتك لفريق بلقيس…' : 'Write your message to Balqees Care…'}/><button onClick={sendReply} disabled={sending || !reply.trim()}>{sending ? <LoaderCircle className="spin"/> : <Send/>}</button></div><button className="individual-support-resolve" onClick={closeConversation}><CheckCheck size={15}/>{ar ? 'تم حل المشكلة' : 'Issue resolved'}</button></>}</footer>
      </section>}

      <div className="individual-support-privacy"><ShieldCheck size={17}/><div><strong>{ar ? 'سياق كافٍ فقط' : 'Only the context that is needed'}</strong><p>{ar ? 'مركز العناية يرسل لفريق بلقيس معلومات الحالة الضرورية فقط. ولا ينفذ إلغاءً أو تعويضًا أو تغيير سعر من نفسه.' : 'Balqees Care attaches only the context needed for the case. It never cancels orders, issues compensation, or changes prices on its own.'}</p></div></div>
    </div></main>
    {toast && <div className="individual-toast"><Check size={16}/><span>{toast}</span></div>}
  </SupportChrome>;
}

function SupportInlineEdit({ icon: Icon, title, description, value, setValue, placeholder, multiline, sending, onSave, ar }) {
  return <><div className="individual-support-result-title"><span><Icon/></span><div><small>{ar ? 'أصلحها لي' : 'FIX IT FOR ME'}</small><h2>{title}</h2><p>{description}</p></div></div><label className="individual-support-inline-edit"><span>{title}</span>{multiline ? <textarea rows="4" value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder}/> : <input value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder}/>}</label><div className="individual-support-result-actions"><button className="primary" onClick={onSave} disabled={sending || !String(value || '').trim()}>{sending ? <LoaderCircle className="spin"/> : <Check/>}{ar ? 'حفظ التعديل' : 'Save change'}</button></div></>;
}

function DynamicIcon({ icon: Icon }) { return Icon ? <Icon/> : <HelpCircle/>; }

function FaqRow({ item, ar }) {
  const [open, setOpen] = useState(false);
  return <article className={open ? 'open' : ''}><button type="button" onClick={() => setOpen(v => !v)}><span>{ar ? item.question_ar : (item.question_en || item.question_ar)}</span><ChevronDown size={15}/></button>{open && <p>{ar ? item.answer_ar : (item.answer_en || item.answer_ar)}</p>}</article>;
}
