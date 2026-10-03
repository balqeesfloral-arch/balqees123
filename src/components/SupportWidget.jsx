import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, LogIn, MessageCircleMore, Send, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSystemSettings } from '../lib/systemSettings';

function contextualCopy(context, ar) {
  if (!context?.orderId) return null;
  const no = context.orderNumber ? `#${String(context.orderNumber).padStart(5, '0')}` : '';
  const labels = {
    order_support: [ 'استفسار عن الطلب', 'Order support' ],
    order_action: [ 'مساعدة في إجراء مطلوب', 'Help with required action' ],
    product_change: [ 'طلب تغيير المنتجات', 'Product change request' ],
    urgent_change: [ 'تعديل عاجل على الطلب', 'Urgent order change' ],
    delivery_not_received: [ 'لم يصل الطلب', 'Order did not arrive' ],
    address_problem: [ 'مشكلة في العنوان', 'Address problem' ],
    order_change: [ 'تعديل الطلب', 'Order change' ],
    product_issue: [ 'مشكلة في المنتج', 'Product issue' ],
    cancel_request: [ 'طلب إلغاء الطلب', 'Order cancellation request' ],
    other_issue: [ 'مشكلة أخرى في الطلب', 'Other order issue' ],
  };
  const label = labels[context.category]?.[ar ? 0 : 1] || (ar ? 'بخصوص الطلب' : 'About order');
  return {
    subject: `${label}${no ? ` ${no}` : ''}`,
    message: context.preset || '',
    summary: ar ? `بخصوص الطلب ${no || ''}${context.orderStatus ? ` · الحالة: ${context.orderStatus}` : ''}` : `About order ${no || ''}${context.orderStatus ? ` · status: ${context.orderStatus}` : ''}`,
  };
}

export default function SupportWidget({ lang }) {
  const ar = lang === 'ar';
  const { settings: systemSettings } = useSystemSettings();
  const settings = systemSettings.support;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('faq');
  const [faqs, setFaqs] = useState([]);
  const [session, setSession] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [context, setContext] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return;
      const [{ data: f }, { data: auth }] = await Promise.all([
        supabase.from('faq_items').select('*').eq('is_active', true).order('sort_order').limit(8),
        supabase.auth.getSession(),
      ]);
      if (!mounted) return;
      setFaqs(f || []);
      setSession(auth?.session || null);
    })();
    if (!supabase) return () => { mounted = false; };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, next) => mounted && setSession(next));
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const openCare = event => {
      const nextContext = event?.detail || null;
      setContext(nextContext);
      const copy = contextualCopy(nextContext, ar);
      if (copy) { setSubject(copy.subject); setMessage(copy.message); }
      setOpen(true);
      setTab('contact');
    };
    window.addEventListener('balqees-open-support', openCare);
    return () => window.removeEventListener('balqees-open-support', openCare);
  }, [ar]);

  const visibleFaqs = useMemo(() => faqs.filter(x => x.is_featured).length ? faqs.filter(x => x.is_featured) : faqs, [faqs]);
  const contextCopy = contextualCopy(context, ar);

  async function sendTicket(e) {
    e.preventDefault();
    if (!supabase || !session || !subject.trim() || !message.trim()) return;
    setSending(true);
    const conversationPayload = {
      user_id: session.user.id,
      subject: subject.trim(),
      status: 'open',
      priority: ['delivery_not_received', 'address_problem', 'urgent_change'].includes(context?.category) ? 'high' : 'normal',
      order_id: context?.orderId || null,
      category: context?.category || 'general',
      requires_human: true,
      context_snapshot: context?.orderId ? {
        order_id: context.orderId,
        order_number: context.orderNumber || null,
        order_status: context.orderStatus || null,
        source: 'individual_account',
      } : { source: 'support_widget' },
    };
    let c = null;
    let error = null;
    if (context?.orderId) {
      const existing = await supabase.from('support_conversations')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('order_id', context.orderId)
        .eq('category', context?.category || 'order_support')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      c = existing.data || null;
      error = existing.error || null;
      if (c?.status === 'closed' && !error) {
        const reopened = await supabase.rpc('customer_reopen_support', { p_conversation_id: c.id });
        error = reopened.error || null;
        if (!error) c = { ...c, status: 'open' };
      }
    }
    if (!c && !error) {
      const created = await supabase.from('support_conversations').insert(conversationPayload).select().single();
      c = created.data || null;
      error = created.error || null;
    }
    if (!error && c) {
      const { error: messageError } = await supabase.from('support_messages').insert({ conversation_id: c.id, sender_id: session.user.id, sender_role: 'user', body: message.trim() });
      if (!messageError) {
        setSubject(''); setMessage(''); setContext(null); setSent(true);
        setTimeout(() => setSent(false), 5000);
      }
    }
    setSending(false);
  }

  if (settings.enabled === false) return null;
  return <div className={`support-widget ${open ? 'open' : ''}`}>
    <button className="support-fab support-fab-icon" onClick={() => setOpen(v => !v)} aria-label={ar ? 'فتح المساعد' : 'Open assistant'}>{open ? <X size={22}/> : <MessageCircleMore size={24}/>}</button>
    {open && <aside className="support-panel"><header><div><small>BALQEES CARE</small><h3>{ar ? 'مساعد بلقيس' : 'Balqees Assistant'}</h3><p>{ar ? 'أسئلة سريعة ومركز عناية.' : 'Quick help and care center.'}</p></div><button onClick={() => setOpen(false)}><X size={17}/></button></header>
      <div className="support-tabs"><button className={tab === 'faq' ? 'active' : ''} onClick={() => setTab('faq')}>{ar ? 'الأسئلة الشائعة' : 'FAQs'}</button><button className={tab === 'contact' ? 'active' : ''} onClick={() => setTab('contact')}>{ar ? 'تواصل معنا' : 'Contact'}</button></div>
      {tab === 'faq' && <div className="support-body">{settings.showFaq !== false && visibleFaqs.map(item => <article className={expanded === item.id ? 'open' : ''} key={item.id}><button onClick={() => setExpanded(expanded === item.id ? null : item.id)}><span>{ar ? item.question_ar : (item.question_en || item.question_ar)}</span><ChevronDown size={16}/></button>{expanded === item.id && <p>{ar ? item.answer_ar : (item.answer_en || item.answer_ar)}</p>}</article>)}{settings.showFaq !== false && !visibleFaqs.length && <div className="support-empty">{ar ? 'سنضيف الأسئلة الشائعة هنا قريبًا.' : 'FAQs will appear here soon.'}</div>}<button className="support-contact-cta" onClick={() => setTab('contact')}><MessageCircleMore size={17}/>{ar ? 'تواصل معنا' : 'Contact us'}</button></div>}
      {tab === 'contact' && <div className="support-body support-contact-body">{session && settings.signedInTickets !== false ? <><div className="support-guest"><MessageCircleMore size={27}/><strong>{ar ? 'مركز العناية الكامل' : 'Full Balqees Care'}</strong><p>{ar ? 'للمتابعة افتح مركز العناية داخل حسابك.' : 'Open Balqees Care in your account.'}</p><Link className="btn primary wide" to="/account/support" onClick={() => setOpen(false)}>{ar ? 'فتح مركز العناية' : 'Open Balqees Care'}</Link></div><form className="support-widget-legacy-form" onSubmit={sendTicket}>{sent && <div className="support-success">{ar ? 'وصلتنا الحالة بكل سياقها، وستظهر لفريق بلقيس.' : 'Your case and its context reached Balqees Care.'}</div>}{contextCopy && <div className="support-context-card"><small>{ar ? 'سياق المحادثة' : 'CONVERSATION CONTEXT'}</small><strong>{contextCopy.summary}</strong><span>{ar ? 'سيصل رقم الطلب وحالته تلقائيًا مع المحادثة.' : 'Order number and status will be attached automatically.'}</span></div>}<label>{ar ? 'موضوع الرسالة' : 'Subject'}<input required value={subject} onChange={e => setSubject(e.target.value)} placeholder={ar ? 'مثال: مشكلة في الحساب' : 'Example: Account issue'}/></label><label>{ar ? 'التفاصيل' : 'Details'}<textarea required rows="4" value={message} onChange={e => setMessage(e.target.value)} placeholder={ar ? 'اشرح المشكلة أو الاستفسار…' : 'Describe your issue or question…'}/></label><button className="btn primary wide" disabled={sending}><Send size={16}/>{sending ? (ar ? 'جاري الإرسال…' : 'Sending…') : (ar ? 'إرسال لفريق بلقيس' : 'Send to Balqees Care')}</button></form></> : <div className="support-guest"><MessageCircleMore size={27}/><strong>{ar ? 'تواصل سريع' : 'Quick support'}</strong><p>{ar ? 'سجّل الدخول لفتح حالة ومتابعتها.' : 'Sign in to open and track a case.'}</p><Link className="btn ghost wide" to="/account" onClick={() => setOpen(false)}><LogIn size={16}/>{ar ? 'تسجيل الدخول' : 'Sign in'}</Link></div>}</div>}
    </aside>}
  </div>;
}
