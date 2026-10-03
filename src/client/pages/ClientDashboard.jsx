import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpLeft,
  BellRing,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleGauge,
  Clock3,
  FileCheck2,
  FileText,
  Flower2,
  Leaf,
  MapPinned,
  MessageSquareText,
  PackageCheck,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useClientPortal } from '../ClientPortalContext';
import { daysUntil, fmtDate, orderLabels, sar, statusTone } from '../portalUtils';

const ORDER_PROGRESS = {
  pending: 1,
  under_review: 2,
  quoted: 3,
  approved: 4,
  in_progress: 5,
  completed: 6,
  cancelled: 0,
};

const ORDER_STEPS = {
  ar: ['الطلب', 'المراجعة', 'التسعير', 'الاعتماد', 'التنفيذ', 'الإغلاق'],
  en: ['Request', 'Review', 'Quote', 'Approval', 'Execution', 'Closed'],
};


export default function ClientDashboard() {
  const { lang, organization, profile, membership, permissions, portalSettings } = useClientPortal();
  const ar = lang === 'ar';
  const dashboardDisplay = portalSettings?.effective_display || {};
  const dashboardWidgetOrder = Array.isArray(dashboardDisplay.widget_order) && dashboardDisplay.widget_order.length
    ? dashboardDisplay.widget_order
    : ['attention','operations','insights','milestones','recent'];
  const widgetVisible = (key) => dashboardDisplay?.widget_visibility?.[key] !== false;
  const widgetStyle = (key) => ({ order: 10 + Math.max(0, dashboardWidgetOrder.indexOf(key)) });
  const [data, setData] = useState({ orders: [], quotes: [], contracts: [], docs: [], support: [], sites: [] });
  const [counts, setCounts] = useState({ completedOrders: 0, acceptedQuotes: 0, allOrders: 0, allQuotes: 0, activeOrders: 0, openQuotes: 0, activeContracts: 0, openSupport: 0, activeSites: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!organization?.id) return;
    setLoading(true);
    setError('');
    const id = organization.id;

    const [orders, quotes, contracts, docs, support, sites, completedCount, acceptedCount, allOrdersCount, allQuotesCount, activeOrdersCount, openQuotesCount, activeContractsCount, openSupportCount, activeSitesCount] = await Promise.all([
      supabase
        .from('orders')
        .select('id,order_number,status,total,created_at,requested_delivery_date,po_number,service_address,customer_note')
        .eq('organization_id', id)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('quotations')
        .select('id,quote_number,status,total,valid_until,created_at,title_ar,title_en')
        .eq('organization_id', id)
        .eq('is_current', true)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('contracts')
        .select('id,contract_number,title_ar,title_en,status,starts_on,ends_on')
        .eq('organization_id', id)
        .order('created_at', { ascending: false })
        .limit(8),
      permissions.viewFinance
        ? supabase
            .from('client_documents')
            .select('id,document_type,document_number,title_ar,title_en,total_amount,issue_date,payment_status,created_at')
            .eq('organization_id', id)
            .order('created_at', { ascending: false })
            .limit(6)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('support_conversations')
        .select('id,subject,status,last_message_at')
        .eq('organization_id', id)
        .order('last_message_at', { ascending: false })
        .limit(6),
      supabase
        .from('organization_sites')
        .select('id,name_ar,name_en,is_default,site_type,contact_name,contact_phone,access_notes,address,is_active')
        .eq('organization_id', id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .limit(12),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('organization_id', id).eq('status', 'completed'),
      supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('organization_id', id).eq('is_current', true).eq('status', 'accepted'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('organization_id', id),
      supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('organization_id', id).eq('is_current', true),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('organization_id', id).in('status', ['pending', 'under_review', 'quoted', 'approved', 'in_progress']),
      supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('organization_id', id).eq('is_current', true).in('status', ['sent', 'viewed']),
      supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('organization_id', id).in('status', ['active', 'expiring']),
      supabase.from('support_conversations').select('id', { count: 'exact', head: true }).eq('organization_id', id).in('status', ['open', 'pending']),
      supabase.from('organization_sites').select('id', { count: 'exact', head: true }).eq('organization_id', id).eq('is_active', true),
    ]);

    const err = orders.error || quotes.error || contracts.error || docs.error || support.error || sites.error || completedCount.error || acceptedCount.error || allOrdersCount.error || allQuotesCount.error || activeOrdersCount.error || openQuotesCount.error || activeContractsCount.error || openSupportCount.error || activeSitesCount.error;
    if (err) setError(ar ? 'تعذر تحميل بعض بيانات مساحة العمل الآن.' : 'Some workspace data could not be loaded right now.');

    setData({
      orders: orders.data || [],
      quotes: quotes.data || [],
      contracts: contracts.data || [],
      docs: docs.data || [],
      support: support.data || [],
      sites: sites.data || [],
    });
    setCounts({
      completedOrders: completedCount.count || 0,
      acceptedQuotes: acceptedCount.count || 0,
      allOrders: allOrdersCount.count || 0,
      allQuotes: allQuotesCount.count || 0,
      activeOrders: activeOrdersCount.count || 0,
      openQuotes: openQuotesCount.count || 0,
      activeContracts: activeContractsCount.count || 0,
      openSupport: openSupportCount.count || 0,
      activeSites: activeSitesCount.count || 0,
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [organization?.id, permissions.viewFinance]);

  const activeOrders = data.orders.filter((x) => !['completed', 'cancelled'].includes(x.status));
  const openQuotes = permissions.acceptQuotes ? data.quotes.filter((x) => ['sent', 'viewed'].includes(x.status)) : [];
  const activeContracts = data.contracts.filter((x) => ['active', 'expiring'].includes(x.status));
  const openSupport = data.support.filter((x) => !['closed', 'resolved'].includes(x.status));
  const recentDoc = data.docs[0] || null;


  const activeOrder = useMemo(() => {
    const priority = ['in_progress', 'approved', 'quoted', 'under_review', 'pending'];
    for (const status of priority) {
      const match = activeOrders.find((order) => order.status === status);
      if (match) return match;
    }
    return activeOrders[0] || null;
  }, [activeOrders]);

  const attention = useMemo(() => {
    const list = [];

    openQuotes.forEach((quote) => {
      list.push({
        kind: 'quote',
        id: quote.id,
        priority: 1,
        title: ar
          ? `عرض السعر #${String(quote.quote_number).padStart(5, '0')} ينتظر قرارك`
          : `Quotation #${String(quote.quote_number).padStart(5, '0')} awaits your decision`,
        text: quote.valid_until
          ? ar
            ? `صالح حتى ${fmtDate(quote.valid_until, lang)}`
            : `Valid until ${fmtDate(quote.valid_until, lang)}`
          : ar
            ? 'راجع تفاصيل العرض قبل متابعة العملية.'
            : 'Review the quotation before the process continues.',
        href: `/portal/quotes/${quote.id}`,
      });
    });

    data.contracts.forEach((contract) => {
      const remaining = daysUntil(contract.ends_on);
      if (remaining !== null && remaining >= 0 && remaining <= 45) {
        list.push({
          kind: 'contract',
          id: contract.id,
          priority: 2,
          title: ar ? `العقد ${contract.contract_number} يقترب من الانتهاء` : `Contract ${contract.contract_number} is nearing expiry`,
          text: ar ? `متبقي ${remaining} يوم` : `${remaining} days remaining`,
          href: `/portal/contracts/${contract.id}`,
        });
      }
    });

    data.orders
      .filter((order) => ['pending', 'under_review', 'quoted'].includes(order.status))
      .forEach((order) => {
        list.push({
          kind: 'order',
          id: order.id,
          priority: order.status === 'quoted' ? 2 : 3,
          title: ar
            ? `الطلب #${String(order.order_number).padStart(5, '0')} · ${orderLabels.ar[order.status] || order.status}`
            : `Order #${String(order.order_number).padStart(5, '0')} · ${orderLabels.en[order.status] || order.status}`,
          text: fmtDate(order.created_at, lang),
          href: `/portal/orders/${order.id}`,
        });
      });

    if (openSupport.length) {
      const conversation = openSupport[0];
      list.push({
        kind: 'care',
        id: conversation.id,
        priority: 3,
        title: ar ? 'لديك محادثة عناية مفتوحة' : 'You have an open care conversation',
        text: conversation.subject || (ar ? 'افتح المحادثة لمتابعة آخر رد.' : 'Open the conversation to review the latest update.'),
        href: `/portal/support?conversation=${conversation.id}`,
      });
    }

    return list.sort((a, b) => a.priority - b.priority).slice(0, 4);
  }, [data, openQuotes, openSupport, ar, lang]);

  const readiness = useMemo(() => {
    const defaultSite = data.sites.find((site) => site.is_default) || data.sites[0];
    const checks = [
      Boolean(organization?.display_name),
      Boolean(organization?.contact_email || profile?.email),
      Boolean(organization?.contact_phone || profile?.phone),
      Boolean(organization?.commercial_number),
      Boolean(organization?.vat_number),
      data.sites.length > 0,
      Boolean(defaultSite?.contact_name || defaultSite?.contact_phone),
      Boolean(defaultSite?.access_notes || defaultSite?.address?.city),
    ];
    const done = checks.filter(Boolean).length;
    const percentage = Math.round((done / checks.length) * 100);
    const next = [];
    if (!data.sites.length) next.push(ar ? 'أضف أول موقع خدمة' : 'Add your first service site');
    if (data.sites.length && !defaultSite?.contact_name && !defaultSite?.contact_phone) next.push(ar ? 'حدد مسؤول الاستلام للموقع الرئيسي' : 'Assign a receiving contact for the main site');
    if (!organization?.contact_phone && !profile?.phone) next.push(ar ? 'أضف رقم تواصل' : 'Add a contact number');
    if (!organization?.commercial_number) next.push(ar ? 'استكمل رقم السجل/الرقم الموحد' : 'Complete the commercial/unified number');
    if (!organization?.vat_number) next.push(ar ? 'استكمل الرقم الضريبي' : 'Complete the VAT number');
    return { percentage, next: next.slice(0, 2) };
  }, [organization, profile, data.sites, ar]);

  const milestones = useMemo(() => [
    {
      key: 'profile',
      label: ar ? 'إعداد المنشأة' : 'Organization setup',
      detail: ar ? `${readiness.percentage}% مكتمل` : `${readiness.percentage}% complete`,
      complete: readiness.percentage >= 75,
      icon: Building2,
    },
    {
      key: 'site',
      label: ar ? 'أول موقع خدمة' : 'First service site',
      detail: counts.activeSites ? (ar ? `${counts.activeSites} مواقع نشطة` : `${counts.activeSites} active sites`) : (ar ? 'لم يضف بعد' : 'Not added yet'),
      complete: counts.activeSites > 0,
      icon: MapPinned,
    },
    {
      key: 'quote',
      label: ar ? 'أول عرض معتمد' : 'First accepted quotation',
      detail: counts.acceptedQuotes ? (ar ? `${counts.acceptedQuotes} عروض معتمدة` : `${counts.acceptedQuotes} accepted quotations`) : (ar ? 'بانتظار أول اعتماد' : 'Awaiting the first approval'),
      complete: counts.acceptedQuotes > 0,
      icon: FileCheck2,
    },
    {
      key: 'order',
      label: ar ? 'أول عملية مكتملة' : 'First completed operation',
      detail: counts.completedOrders ? (ar ? `${counts.completedOrders} عمليات مكتملة` : `${counts.completedOrders} completed operations`) : (ar ? 'بانتظار أول إغلاق' : 'Awaiting the first completion'),
      complete: counts.completedOrders > 0,
      icon: PackageCheck,
    },
  ], [ar, readiness.percentage, counts.activeSites, counts.acceptedQuotes, counts.completedOrders]);

  const gardenLevel = useMemo(() => {
    let score = readiness.percentage * 0.42;
    score += Math.min(counts.activeSites, 3) * 7;
    score += counts.acceptedQuotes > 0 ? 12 : 0;
    score += counts.completedOrders > 0 ? 15 : 0;
    score += counts.activeContracts > 0 ? 10 : 0;
    return Math.max(12, Math.min(100, Math.round(score)));
  }, [readiness.percentage, counts.activeSites, counts.acceptedQuotes, counts.completedOrders, counts.activeContracts]);

  const insight = useMemo(() => {
    if (openQuotes.length) {
      return {
        icon: FileText,
        eyebrow: ar ? 'قرار قريب' : 'DECISION READY',
        title: ar ? `لديك ${openQuotes.length} عرض ${openQuotes.length === 1 ? 'ينتظر' : 'تنتظر'} قرارك` : `${openQuotes.length} quotation${openQuotes.length === 1 ? '' : 's'} await your decision`,
        text: ar ? 'مراجعتها أولًا تحافظ على سير الطلبات بدون توقف.' : 'Reviewing these first keeps procurement moving without delay.',
        href: '/portal/quotes',
      };
    }
    const ending = data.contracts
      .map((contract) => ({ ...contract, remaining: daysUntil(contract.ends_on) }))
      .filter((contract) => contract.remaining !== null && contract.remaining >= 0)
      .sort((a, b) => a.remaining - b.remaining)[0];
    if (ending && ending.remaining <= 90) {
      return {
        icon: CalendarClock,
        eyebrow: ar ? 'نظرة تعاقدية' : 'CONTRACT INSIGHT',
        title: ar ? `أقرب عقد ينتهي بعد ${ending.remaining} يوم` : `Your nearest contract ends in ${ending.remaining} days`,
        text: ar ? (ending.title_ar || ending.contract_number) : (ending.title_en || ending.title_ar || ending.contract_number),
        href: `/portal/contracts/${ending.id}`,
      };
    }
    if (counts.completedOrders > 0) {
      return {
        icon: TrendingUp,
        eyebrow: ar ? 'محطات العلاقة' : 'PARTNERSHIP INSIGHT',
        title: ar ? `${counts.completedOrders} عمليات مكتملة مع بلقيس` : `${counts.completedOrders} completed operations with Balqees`,
        text: ar ? 'سجل المنشأة التشغيلي يبدأ في تكوين ذاكرة تسهّل الطلبات القادمة.' : 'Your operating history is building a reusable memory for future requests.',
        href: '/portal/orders',
      };
    }
    return {
      icon: Leaf,
      eyebrow: ar ? 'بداية الشراكة' : 'PARTNERSHIP START',
      title: ar ? 'كل معلومة تضيفها تجعل الخدمة أسرع' : 'Every detail you add makes service faster',
      text: ar ? 'ابدأ بإكمال الموقع ومسؤول الاستلام حتى تصبح الطلبات القادمة أقصر.' : 'Complete your site and receiving contact so future requests take less effort.',
      href: '/portal/sites',
    };
  }, [openQuotes.length, data.contracts, counts.completedOrders, ar]);

  const InsightIcon = insight.icon;

  const heroTitle = attention.length
    ? ar
      ? `لديك ${attention.length} ${attention.length === 1 ? 'أمر يستحق' : 'أمور تستحق'} انتباهك اليوم.`
      : `${attention.length} ${attention.length === 1 ? 'item deserves' : 'items deserve'} your attention today.`
    : ar
      ? 'كل شيء تحت السيطرة.'
      : 'Everything is under control.';

  const currentStage = activeOrder ? ORDER_PROGRESS[activeOrder.status] || 1 : 0;
  const currentSiteLabel = activeOrder?.service_address?.district || activeOrder?.service_address?.city || '';
  const primaryActionHref = permissions.placeOrders ? '/portal/request' : permissions.viewCatalog ? '/portal/catalog' : permissions.viewOrders ? '/portal/orders' : '/portal/settings';
  const primaryActionLabel = permissions.placeOrders ? (ar ? 'ابدأ طلبًا جديدًا' : 'Start a new request') : permissions.viewCatalog ? (ar ? 'استكشف الكتالوج' : 'Explore catalog') : (ar ? 'عرض مساحة العمل' : 'View workspace');
  const readinessHref = data.sites.length || !permissions.viewSites ? '/portal/settings?tab=organization' : '/portal/sites';

  return (
    <div className="client-page client-dashboard-page client-dashboard-v2">
      <section className="client-partnership-hero">
        <div className="client-partnership-scene" style={{ '--garden-level': `${gardenLevel}%` }}>
          <div className="client-garden-photo" />
          <div className="client-garden-shade" />
          <div className="client-garden-orbit orbit-one" />
          <div className="client-garden-orbit orbit-two" />
          <div className="client-garden-leaf leaf-a"><Leaf /></div>
          <div className="client-garden-leaf leaf-b"><Leaf /></div>
          <div className="client-garden-leaf leaf-c"><Flower2 /></div>
          <div className="client-partnership-meter">
            <span>{ar ? 'نمو الشراكة' : 'PARTNERSHIP GROWTH'}</span>
            <strong>{gardenLevel}%</strong>
            <i><b /></i>
          </div>
        </div>

        <div className="client-partnership-copy">
          <div className="client-partnership-kicker"><Sparkles />{ar ? 'نبض منشأتكم مع بلقيس' : 'YOUR ORGANIZATION PULSE'}</div>
          <h2>{heroTitle}</h2>
          <p>
            {ar
              ? <>مرحبًا <b>{profile?.full_name || organization?.display_name || ''}</b>. هذه مساحة <strong>{organization?.display_name}</strong> الحية؛ نعرض لك فقط ما يستحق القرار أو المتابعة الآن.</>
              : <>Welcome <b>{profile?.full_name || organization?.display_name || ''}</b>. This is <strong>{organization?.display_name}</strong>'s live workspace — focused on what deserves action now.</>}
          </p>
          <div className="client-partnership-stats">
            <span><PackageSearch /><b>{counts.activeOrders}</b><small>{ar ? 'طلبات نشطة' : 'active orders'}</small></span>
            <span><FileCheck2 /><b>{counts.activeContracts}</b><small>{ar ? 'عقود نشطة' : 'active contracts'}</small></span>
            <span><MapPinned /><b>{counts.activeSites}</b><small>{ar ? 'مواقع خدمة' : 'service sites'}</small></span>
          </div>
          <div className="client-partnership-actions">
            <Link to={primaryActionHref} className="client-primary"><PackageSearch />{primaryActionLabel}</Link>
            {permissions.createSupportCases&&<Link to="/portal/support" className="client-ghost-light"><MessageSquareText />{ar ? 'عناية بلقيس' : 'Balqees Care'}</Link>}
          </div>
        </div>
      </section>

      {error && (
        <div className="client-inline-error">
          {error}
          <button onClick={load}><RefreshCw />{ar ? 'إعادة المحاولة' : 'Retry'}</button>
        </div>
      )}

      <section style={{...widgetStyle('attention'),display:widgetVisible('attention')?undefined:'none'}} className={`client-today-pulse ${attention.length ? 'has-action' : 'is-calm'}`}>
        <div className="client-today-pulse-head">
          <span className="client-pulse-orb"><BellRing /></span>
          <div>
            <small>{ar ? 'نبض اليوم' : 'TODAY PULSE'}</small>
            <h3>{attention.length ? (ar ? 'ابدأ بما يحتاج قرارك' : 'Start with what needs you') : (ar ? 'أمورك مرتبة' : 'You are all caught up')}</h3>
          </div>
          <button onClick={load} aria-label={ar ? 'تحديث' : 'Refresh'}><RefreshCw className={loading ? 'spin' : ''} /></button>
        </div>
        {attention.length ? (
          <div className="client-pulse-actions">
            {attention.map((item) => {
              const Icon = item.kind === 'quote' ? FileText : item.kind === 'contract' ? CalendarClock : item.kind === 'care' ? MessageSquareText : PackageSearch;
              return (
                <Link to={item.href} key={`${item.kind}-${item.id}`} className={`pulse-action-card ${item.kind}`}>
                  <span><Icon /></span>
                  <div><strong>{item.title}</strong><small>{item.text}</small></div>
                  <ArrowUpLeft />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="client-calm-state">
            <CheckCircle2 />
            <div><strong>{ar ? 'لا توجد إجراءات مطلوبة منك الآن.' : 'No action is required from you right now.'}</strong><p>{ar ? 'فريق بلقيس يواصل متابعة العمليات الحالية، وسنضع أي قرار مهم هنا فور ظهوره.' : 'Balqees continues to follow active operations. Any important decision will appear here when it is needed.'}</p></div>
          </div>
        )}
      </section>

      <div style={{...widgetStyle('operations'),display:widgetVisible('operations')?undefined:'none'}} className="client-dashboard-v2-main">
        <section className="client-live-operation">
          <header>
            <div><span><PackageSearch />{ar ? 'العملية الحية' : 'LIVE OPERATION'}</span><h3>{ar ? 'أين وصل العمل الآن؟' : 'Where is the work now?'}</h3></div>
            <Link to="/portal/orders">{ar ? 'كل الطلبات' : 'All orders'}<ArrowUpLeft /></Link>
          </header>
          {activeOrder ? (
            <div className="client-operation-body">
              <div className="client-operation-summary">
                <div>
                  <small>{ar ? 'الطلب الحالي' : 'CURRENT ORDER'}</small>
                  <strong>#{String(activeOrder.order_number).padStart(5, '0')}</strong>
                  <p>{currentSiteLabel || (ar ? 'عملية منشأة نشطة' : 'Active organization operation')}</p>
                </div>
                <span className={`client-operation-status ${statusTone(activeOrder.status)}`}>{orderLabels[lang][activeOrder.status] || activeOrder.status}</span>
              </div>
              <div className="client-operation-track">
                {ORDER_STEPS[lang].map((label, index) => {
                  const step = index + 1;
                  const done = currentStage > step;
                  const current = currentStage === step;
                  return (
                    <div className={`${done ? 'done' : ''} ${current ? 'current' : ''}`} key={label}>
                      <i>{done ? <CheckCircle2 /> : step}</i>
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="client-operation-meta">
                <span><Clock3 /><small>{ar ? 'آخر تسجيل' : 'Recorded'}</small><b>{fmtDate(activeOrder.created_at, lang, true)}</b></span>
                <span><CalendarClock /><small>{ar ? 'الموعد المطلوب' : 'Requested date'}</small><b>{activeOrder.requested_delivery_date ? fmtDate(activeOrder.requested_delivery_date, lang) : '—'}</b></span>
                {permissions.canSeePrices && <span><ReceiptText /><small>{ar ? 'القيمة' : 'Value'}</small><b>{sar(activeOrder.total, lang)}</b></span>}
              </div>
            </div>
          ) : (
            <div className="client-operation-empty"><PackageCheck /><strong>{ar ? 'لا توجد عملية نشطة الآن.' : 'No active operation right now.'}</strong><p>{ar ? 'عند بدء طلب جديد ستظهر رحلته هنا من المراجعة حتى الإغلاق.' : 'When a new request starts, its journey will appear here from review through completion.'}</p>{permissions.viewCatalog&&<Link className="client-secondary" to="/portal/catalog">{ar ? 'استكشاف الكتالوج' : 'Explore catalog'}</Link>}</div>
          )}
        </section>

        <aside className="client-care-mini">
          <header><span><Flower2 /></span><div><small>{ar ? 'عناية بلقيس' : 'BALQEES CARE'}</small><h3>{ar ? 'كيف نخدم منشأتكم؟' : 'How can we help?'}</h3></div></header>
          <p>{ar ? 'وصول مباشر إلى مركز العناية الذكي المرتبط ببيانات منشأتكم وصلاحياتكم، مع إمكانية التحويل لفريق بلقيس عند الحاجة.' : 'Direct access to Smart Care, grounded in your organization data and permissions, with human handoff whenever needed.'}</p>
          <div className="client-care-actions">
            <Link to="/portal/orders"><PackageSearch /><span><b>{ar ? 'متابعة طلب' : 'Track an order'}</b><small>{ar ? 'الحالة والتحديثات' : 'Status and updates'}</small></span></Link>
            <Link to="/portal/quotes"><FileText /><span><b>{ar ? 'عرض سعر' : 'Quotation'}</b><small>{ar ? 'اعتماد أو تعديل' : 'Approve or revise'}</small></span></Link>
            {permissions.viewFinance && <Link to="/portal/financial"><ReceiptText /><span><b>{ar ? 'فاتورة أو مستند' : 'Invoice or document'}</b><small>{ar ? 'الوصول للمستند الرسمي' : 'Open the official document'}</small></span></Link>}
            {permissions.createSupportCases&&<Link to="/portal/support"><MessageSquareText /><span><b>{ar ? 'تحدث مع بلقيس' : 'Talk to Balqees'}</b><small>{counts.openSupport ? (ar ? `${counts.openSupport} محادثات مفتوحة` : `${counts.openSupport} open conversations`) : (ar ? 'ابدأ محادثة جديدة' : 'Start a new conversation')}</small></span></Link>}
          </div>
          {permissions.createSupportCases&&<Link to="/portal/support" className="client-care-full">{ar ? 'فتح مركز العناية' : 'Open care center'}<ArrowUpLeft /></Link>}
        </aside>
      </div>

      <div style={{...widgetStyle('insights'),display:widgetVisible('insights')?undefined:'none'}} className="client-dashboard-v2-insights">
        <section className="client-readiness-card">
          <div className="client-readiness-ring" style={{ '--readiness': `${readiness.percentage * 3.6}deg` }}>
            <div><CircleGauge /><strong>{readiness.percentage}%</strong><small>{ar ? 'جاهزية' : 'ready'}</small></div>
          </div>
          <div className="client-readiness-copy">
            <small>{ar ? 'جاهزية المنشأة' : 'ORGANIZATION READINESS'}</small>
            <h3>{readiness.percentage >= 90 ? (ar ? 'جاهزية ممتازة للعمل' : 'Excellent operating readiness') : (ar ? 'كل خطوة تختصر الطلب القادم' : 'Every step shortens the next request')}</h3>
            {readiness.next.length ? (
              <ul>{readiness.next.map((item) => <li key={item}><CheckCircle2 />{item}</li>)}</ul>
            ) : (
              <p>{ar ? 'البيانات الأساسية التي نحتاجها للخدمة اليومية مكتملة.' : 'The core information needed for day-to-day service is complete.'}</p>
            )}
            <Link to={readinessHref}>{ar ? 'استكمال الإعداد' : 'Complete setup'}<ArrowUpLeft /></Link>
          </div>
        </section>

        <section className="client-smart-insight">
          <div className="client-insight-icon"><InsightIcon /></div>
          <small>{insight.eyebrow}</small>
          <h3>{insight.title}</h3>
          <p>{insight.text}</p>
          <Link to={insight.href}>{ar ? 'عرض التفاصيل' : 'View details'}<ArrowUpLeft /></Link>
        </section>

        <section className="client-account-health">
          <div className="client-health-orb"><ShieldCheck /></div>
          <small>{ar ? 'حالة مساحة العمل' : 'WORKSPACE HEALTH'}</small>
          <h3>{ar ? 'مرتبطة ببيانات حقيقية' : 'Grounded in real data'}</h3>
          <div className="client-health-list">
            <span><i className={counts.activeSites ? 'good' : 'neutral'} /><b>{ar ? 'المواقع' : 'Sites'}</b><em>{counts.activeSites}</em></span>
            <span><i className={counts.activeContracts ? 'good' : 'neutral'} /><b>{ar ? 'العقود النشطة' : 'Active contracts'}</b><em>{counts.activeContracts}</em></span>
            <span><i className={counts.openSupport ? 'warn' : 'good'} /><b>{ar ? 'العناية المفتوحة' : 'Open care'}</b><em>{counts.openSupport}</em></span>
          </div>
        </section>
      </div>

      <section style={{...widgetStyle('milestones'),display:widgetVisible('milestones')?undefined:'none'}} className="client-milestones">
        <header>
          <div><span><Sparkles />{ar ? 'محطات الشراكة' : 'PARTNERSHIP MILESTONES'}</span><h3>{ar ? 'التقدم الذي صنعتموه مع بلقيس' : 'Progress you have built with Balqees'}</h3></div>
          <small>{ar ? `${counts.allOrders} طلبات مسجلة • ${counts.allQuotes} عروض سعر` : `${counts.allOrders} orders recorded • ${counts.allQuotes} quotations`}</small>
        </header>
        <div className="client-milestone-track">
          {milestones.map(({ key, label, detail, complete, icon: Icon }, index) => (
            <article key={key} className={complete ? 'complete' : 'pending'}>
              <div className="client-milestone-line"><i /><b /></div>
              <span><Icon /></span>
              <small>{String(index + 1).padStart(2, '0')}</small>
              <strong>{label}</strong>
              <p>{detail}</p>
              <em>{complete ? (ar ? 'مكتمل' : 'Completed') : (ar ? 'قادم' : 'Upcoming')}</em>
            </article>
          ))}
        </div>
      </section>

      <div style={{...widgetStyle('recent'),display:widgetVisible('recent')?undefined:'none'}} className="client-dashboard-v2-bottom">
        <section className="client-recent-stream">
          <header><div><span><Clock3 />{ar ? 'آخر الحركة' : 'RECENT ACTIVITY'}</span><h3>{ar ? 'ما تغير مؤخرًا؟' : 'What changed recently?'}</h3></div><Link to="/portal/orders">{ar ? 'مركز العمليات' : 'Operations center'}<ArrowUpLeft /></Link></header>
          <div className="client-stream-list">
            {data.orders.slice(0, 3).map((order) => (
              <Link to={`/portal/orders/${order.id}`} key={order.id}>
                <i className={statusTone(order.status)}><PackageSearch /></i>
                <div><strong>{ar ? `الطلب #${String(order.order_number).padStart(5, '0')}` : `Order #${String(order.order_number).padStart(5, '0')}`}</strong><p>{orderLabels[lang][order.status] || order.status}</p></div>
                <time>{fmtDate(order.created_at, lang, true)}</time>
              </Link>
            ))}
            {recentDoc && permissions.viewFinance && (
              <Link to={`/portal/financial/client_document/${recentDoc.id}`}>
                <i className="good"><ReceiptText /></i>
                <div><strong>{ar ? 'مستند مالي حديث' : 'Recent financial document'}</strong><p>{recentDoc.document_number || (ar ? recentDoc.title_ar : (recentDoc.title_en || recentDoc.title_ar)) || '—'}</p></div>
                <time>{fmtDate(recentDoc.issue_date || recentDoc.created_at, lang)}</time>
              </Link>
            )}
            {!data.orders.length && !recentDoc && <div className="client-stream-empty"><Clock3 /><span>{ar ? 'سيظهر هنا سجل العمليات والمستندات الجديدة.' : 'Recent operations and documents will appear here.'}</span></div>}
          </div>
        </section>

        <section className="client-balquees-touch">
          <div className="client-touch-image"><img src="/assets/home/premium-arrangement.webp" alt="" /></div>
          <div className="client-touch-copy">
            <small>{ar ? 'لمسة بلقيس' : 'BALQEES TOUCH'}</small>
            <h3>{ar ? 'إلهام هادئ لمساحات الضيافة' : 'A refined touch for hospitality spaces'}</h3>
            <p>{ar ? 'استكشف اختيارات بلقيس الحالية، وأضف ما يناسب منشأتكم إلى الطلب بدل بدء الوصف من الصفر.' : 'Explore the current Balqees selection and use what fits your organization as a starting point for a request.'}</p>
            {permissions.viewCatalog&&<Link to="/portal/catalog">{ar ? 'استكشف الكتالوج' : 'Explore catalog'}<ArrowUpLeft /></Link>}
          </div>
        </section>
      </div>
    </div>
  );
}
