import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  Eye,
  Globe2,
  LayoutPanelLeft,
  LockKeyhole,
  Mail,
  MessageCircle,
  Paintbrush,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Type,
} from 'lucide-react';
import { SYSTEM_SETTING_DEFAULTS, useSystemSettings } from '../../lib/systemSettings';
import { logAdminAction } from '../adminUtils';
import { useLocation } from 'react-router-dom';

const TAB_KEYS = {
  general: ['site_ui'],
  appearance: ['site_ui', 'admin_ui'],
  store: ['store'],
  support: ['support'],
  notifications: ['notifications'],
  security: ['security'],
};

const clone = value => JSON.parse(JSON.stringify(value));

export default function AdminSettings({ lang }) {
  const ar = lang === 'ar';
  const location = useLocation();
  const { settings, refreshSettings, saveSetting, lastSyncedAt } = useSystemSettings();
  const [tab, setTab] = useState('general');
  const [drafts, setDrafts] = useState(() => clone(settings));
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('tab');
    if (TAB_KEYS[requested]) setTab(requested);
  }, [location.search]);

  useEffect(() => {
    if (!Object.keys(dirty).length) setDrafts(clone(settings));
  }, [settings, dirty]);

  const tabs = [
    ['general', Globe2, ar ? 'الموقع وتجربة الزائر' : 'Website & visitor', ar ? 'المواسم والأزرار واللغة' : 'Seasons, actions & language'],
    ['appearance', Paintbrush, ar ? 'المظهر والواجهة' : 'Appearance', ar ? 'الموقع ولوحة الإدارة' : 'Website & admin UI'],
    ['store', ShoppingBag, ar ? 'المتجر والطلبات' : 'Store & orders', ar ? 'الأسعار والضريبة والسياسات' : 'Pricing, VAT & policies'],
    ['support', SlidersHorizontal, ar ? 'الدعم والتواصل' : 'Support', ar ? 'المساعدة والتذاكر وواتساب' : 'Help, tickets & WhatsApp'],
    ['notifications', BellRing, ar ? 'الإشعارات' : 'Notifications', ar ? 'قنوات التنبيه الفعلية' : 'Live delivery channels'],
    ['security', ShieldCheck, ar ? 'الأمان والجلسات' : 'Security', ar ? 'قفل الإدارة وحالة الحماية' : 'Admin lock & protection'],
  ];

  const dirtyCount = Object.keys(dirty).length;
  const currentKeys = TAB_KEYS[tab] || [];
  const currentDirty = currentKeys.some(key => dirty[key]);

  function update(key, patch) {
    setDrafts(current => ({ ...current, [key]: { ...current[key], ...patch } }));
    setDirty(current => ({ ...current, [key]: true }));
    setFlash(null);
  }

  function resetCurrentTab() {
    setDrafts(current => {
      const next = clone(current);
      if (tab === 'general') {
        const d = SYSTEM_SETTING_DEFAULTS.site_ui;
        next.site_ui = { ...next.site_ui, defaultLanguage:d.defaultLanguage, seasonalExperience:d.seasonalExperience, showSeasonMessage:d.showSeasonMessage, showWhatsapp:d.showWhatsapp, showCertification:d.showCertification, showBottomLabels:d.showBottomLabels };
      } else if (tab === 'appearance') {
        const d = SYSTEM_SETTING_DEFAULTS.site_ui;
        next.site_ui = { ...next.site_ui, accent:d.accent, fontScale:d.fontScale, radius:d.radius, contentWidth:d.contentWidth, glass:d.glass, motion:d.motion };
        next.admin_ui = clone(SYSTEM_SETTING_DEFAULTS.admin_ui);
      } else {
        currentKeys.forEach(key => { next[key] = clone(SYSTEM_SETTING_DEFAULTS[key]); });
      }
      return next;
    });
    setDirty(current => ({ ...current, ...Object.fromEntries(currentKeys.map(key => [key, true])) }));
    setFlash(null);
  }

  async function saveKeys(keys) {
    const actual = keys.filter(key => dirty[key]);
    if (!actual.length) return;
    setSaving(true);
    setFlash(null);
    for (const key of actual) {
      const { error } = await saveSetting(key, drafts[key]);
      if (error) {
        setFlash({ type: 'error', text: ar ? 'تعذر حفظ الإعدادات. تحقق من الاتصال وحاول مرة أخرى.' : 'Could not save settings. Check the connection and try again.' });
        setSaving(false);
        return;
      }
      await logAdminAction('update_system_setting', 'system_setting', key, { value: drafts[key] });
    }
    setDirty(current => {
      const next = { ...current };
      actual.forEach(key => delete next[key]);
      return next;
    });
    setFlash({ type: 'success', text: ar ? 'تم الحفظ والتطبيق على النظام.' : 'Saved and applied across the system.' });
    setSaving(false);
  }

  async function reload() {
    setSaving(true);
    const next = await refreshSettings();
    if (next) {
      setDrafts(clone(next));
      setDirty({});
      setFlash({ type: 'success', text: ar ? 'تمت مزامنة الإعدادات من Supabase.' : 'Settings synced from Supabase.' });
    } else setFlash({ type: 'error', text: ar ? 'تعذرت المزامنة. بقيت تعديلاتك محفوظة في الشاشة.' : 'Sync failed. Your unsaved changes are still in this screen.' });
    setSaving(false);
  }

  const site = drafts.site_ui;
  const admin = drafts.admin_ui;
  const store = drafts.store;
  const support = drafts.support;
  const notify = drafts.notifications;
  const security = drafts.security;

  const syncLabel = useMemo(() => {
    if (!lastSyncedAt) return ar ? 'لم تتم المزامنة بعد' : 'Not synced yet';
    return new Intl.DateTimeFormat(ar ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(lastSyncedAt));
  }, [lastSyncedAt, ar]);

  return <div className="admin-page settings-v2">
    <section className="settings-v2-hero">
      <div className="settings-v2-hero-copy">
        <span><Sparkles size={15}/>{ar ? 'مركز إعدادات بلقيس' : 'BALQEES SYSTEM CONTROL'}</span>
        <h2>{ar ? 'إعدادات حقيقية تتحكم بالنظام' : 'Settings that actually control the system'}</h2>
        <p>{ar ? 'كل خيار هنا مربوط بواجهة أو وظيفة فعلية. بعد الحفظ ينتقل التغيير إلى الموقع أو المتجر أو لوحة الإدارة مباشرة.' : 'Every option here is wired to real behavior. Once saved, changes propagate to the website, store or admin portal.'}</p>
      </div>
      <div className="settings-v2-health">
        <div><span className="live-dot"/><small>{ar ? 'Supabase متصل' : 'Supabase connected'}</small><strong>{ar ? 'إعدادات مركزية' : 'Central settings'}</strong></div>
        <div><RefreshCw size={17}/><small>{ar ? 'آخر مزامنة' : 'Last sync'}</small><strong>{syncLabel}</strong></div>
        <button className="admin-secondary-button" onClick={reload} disabled={saving}><RefreshCw className={saving ? 'spin' : ''} size={15}/>{ar ? 'مزامنة' : 'Sync'}</button>
      </div>
    </section>

    {flash && <div className={`settings-v2-flash ${flash.type}`}>{flash.type === 'success' ? <CheckCircle2 size={17}/> : <AlertTriangle size={17}/>}<span>{flash.text}</span></div>}

    <div className="settings-v2-shell">
      <aside className="settings-v2-nav">
        <div className="settings-v2-nav-title"><small>{ar ? 'أقسام الإعدادات' : 'SETTINGS'}</small><strong>{ar ? 'التحكم المركزي' : 'Control center'}</strong></div>
        {tabs.map(([key, Icon, title, desc]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
          <span><Icon size={18}/></span><div><strong>{title}</strong><small>{desc}</small></div>{TAB_KEYS[key].some(k => dirty[k]) && <i/>}
        </button>)}
        <div className="settings-v2-nav-foot"><ShieldCheck size={16}/><span>{ar ? 'الإعدادات الحساسة لا تُعرض للزوار.' : 'Sensitive settings stay private.'}</span></div>
      </aside>

      <main className="settings-v2-content">
        {tab === 'general' && <>
          <SectionHead icon={Globe2} ar={ar} eyebrow={ar ? 'تجربة الموقع' : 'PUBLIC EXPERIENCE'} title={ar ? 'الموقع وتجربة الزائر' : 'Website & visitor experience'} text={ar ? 'تحكم في العناصر العامة التي تظهر لكل زائر بدون تعديل الكود.' : 'Control public-facing behavior without touching code.'}/>
          <SettingPanel title={ar ? 'اللغة والمواسم' : 'Language & seasons'} text={ar ? 'هذه الإعدادات تؤثر على أول زيارة وعلى تجربة المواسم في الموقع.' : 'These affect first-visit language and seasonal experiences.'}>
            <div className="settings-v2-grid two">
              <Field label={ar ? 'اللغة الافتراضية لأول زيارة' : 'Default language for first visit'}><select value={site.defaultLanguage} onChange={e => update('site_ui', { defaultLanguage: e.target.value })}><option value="ar">العربية</option><option value="en">English</option></select></Field>
              <Readout label={ar ? 'طريقة تفعيل الموسم' : 'Season activation'} value={ar ? 'تلقائي حسب التاريخ — مكة' : 'Automatic by date — Makkah'} icon={Sparkles}/>
            </div>
            <div className="settings-v2-toggle-list">
              <Toggle checked={site.seasonalExperience !== false} onChange={() => update('site_ui', { seasonalExperience: site.seasonalExperience === false })} label={ar ? 'تشغيل التصاميم الموسمية تلقائيًا' : 'Automatic seasonal themes'} hint={ar ? 'عند الإيقاف يعود الموقع للهوية الأساسية طوال العام.' : 'When off, the website stays on the default Balqees identity.'}/>
              <Toggle checked={site.showSeasonMessage !== false} onChange={() => update('site_ui', { showSeasonMessage: site.showSeasonMessage === false })} label={ar ? 'إظهار زر الرسالة الموسمية' : 'Show seasonal message action'} hint={ar ? 'يخفي أو يظهر الأيقونة الموسمية التفاعلية.' : 'Shows or hides the interactive seasonal message control.'}/>
            </div>
          </SettingPanel>
          <SettingPanel title={ar ? 'الأزرار العائمة والتنقل' : 'Floating actions & navigation'} text={ar ? 'كل خيار ينعكس مباشرة على الموقع بعد الحفظ.' : 'Each option directly controls the public website after save.'}>
            <div className="settings-v2-toggle-list">
              <Toggle checked={site.showWhatsapp !== false} onChange={() => update('site_ui', { showWhatsapp: site.showWhatsapp === false })} label={ar ? 'زر واتساب العائم' : 'Floating WhatsApp button'} />
              <Toggle checked={site.showCertification !== false} onChange={() => update('site_ui', { showCertification: site.showCertification === false })} label={ar ? 'زر الاعتماد العائم' : 'Floating certification button'} />
              <Toggle checked={site.showBottomLabels !== false} onChange={() => update('site_ui', { showBottomLabels: site.showBottomLabels === false })} label={ar ? 'أسماء الصفحات تحت أيقونات الشريط السفلي' : 'Labels under bottom navigation icons'} />
            </div>
          </SettingPanel>
        </>}

        {tab === 'appearance' && <>
          <SectionHead icon={Paintbrush} ar={ar} eyebrow={ar ? 'الهوية البصرية' : 'VISUAL SYSTEM'} title={ar ? 'المظهر والواجهة' : 'Appearance & interface'} text={ar ? 'إعدادات منفصلة للموقع العام ولوحة الإدارة، وكلها تُقرأ من Supabase.' : 'Separate live controls for the public website and admin portal.'}/>
          <SettingPanel title={ar ? 'الموقع العام' : 'Public website'} text={ar ? 'اضبط النبرة البصرية بدون كسر تصاميم المواسم.' : 'Tune the visual system without breaking seasonal art direction.'}>
            <div className="settings-v2-choice-title"><span>{ar ? 'اللون المساند' : 'Supporting accent'}</span><small>{ar ? 'الموسمي يحافظ على ألوان كل موسم.' : 'Seasonal keeps each season’s palette.'}</small></div>
            <div className="settings-v2-palette">{[['seasonal','#b29255',ar?'موسمي':'Seasonal'],['olive','#496653',ar?'زيتوني':'Olive'],['gold','#a58545',ar?'ذهبي':'Gold'],['sage','#718a73',ar?'مريمي':'Sage']].map(([key,color,label]) => <button key={key} className={site.accent === key ? 'active' : ''} onClick={() => update('site_ui', { accent: key })}><i style={{background:color}}/><span>{label}</span>{site.accent === key && <Check size={14}/>}</button>)}</div>
            <div className="settings-v2-grid three">
              <Field label={ar ? 'حجم الخط العام' : 'Website font scale'}><select value={site.fontScale} onChange={e => update('site_ui', { fontScale: Number(e.target.value) })}><option value="0.95">{ar ? 'أصغر قليلًا' : 'Slightly smaller'}</option><option value="1">{ar ? 'متوازن' : 'Balanced'}</option><option value="1.06">{ar ? 'أكبر' : 'Larger'}</option></select></Field>
              <Field label={ar ? 'عرض المحتوى' : 'Content width'}><select value={site.contentWidth} onChange={e => update('site_ui', { contentWidth: e.target.value })}><option value="compact">{ar ? 'مركز' : 'Compact'}</option><option value="standard">{ar ? 'قياسي' : 'Standard'}</option><option value="wide">{ar ? 'واسع' : 'Wide'}</option></select></Field>
              <Field label={ar ? 'استدارة الواجهات' : 'Corner style'}><select value={site.radius} onChange={e => update('site_ui', { radius: e.target.value })}><option value="sharp">{ar ? 'هادئة' : 'Subtle'}</option><option value="soft">{ar ? 'فاخرة' : 'Soft'}</option><option value="rounded">{ar ? 'مستديرة' : 'Rounded'}</option></select></Field>
            </div>
            <div className="settings-v2-toggle-list compact">
              <Toggle checked={site.glass !== false} onChange={() => update('site_ui', { glass: site.glass === false })} label={ar ? 'الشفافية والزجاج' : 'Glass & translucency'} />
              <Toggle checked={site.motion !== false} onChange={() => update('site_ui', { motion: site.motion === false })} label={ar ? 'الحركات والانتقالات' : 'Motion & transitions'} />
            </div>
            <WebsitePreview ar={ar} site={site}/>
          </SettingPanel>

          <SettingPanel title={ar ? 'لوحة الإدارة' : 'Admin portal'} text={ar ? 'تتحكم فعليًا في حجم الخط والكثافة والقائمة والشريط العلوي وعرض مساحة العمل.' : 'Controls font scale, density, sidebar, topbar and workspace width.'}>
            <div className="settings-v2-palette">{[['olive','#6f826d',ar?'زيتوني':'Olive'],['gold','#9c8150',ar?'ذهبي':'Gold'],['sage','#7f947e',ar?'مريمي':'Sage'],['charcoal','#58605d',ar?'فحمي':'Charcoal']].map(([key,color,label]) => <button key={key} className={admin.accent === key ? 'active' : ''} onClick={() => update('admin_ui', { accent: key })}><i style={{background:color}}/><span>{label}</span>{admin.accent === key && <Check size={14}/>}</button>)}</div>
            <div className="settings-v2-grid three">
              <Field label={ar ? 'حجم خط الإدارة' : 'Admin font scale'}><select value={admin.fontScale} onChange={e => update('admin_ui', { fontScale: Number(e.target.value) })}><option value="0.92">{ar ? 'صغير' : 'Small'}</option><option value="1">{ar ? 'متوازن' : 'Balanced'}</option><option value="1.08">{ar ? 'كبير' : 'Large'}</option></select></Field>
              <Field label={ar ? 'كثافة الجداول والبطاقات' : 'Interface density'}><select value={admin.density} onChange={e => update('admin_ui', { density: e.target.value })}><option value="comfortable">{ar ? 'مريحة' : 'Comfortable'}</option><option value="compact">{ar ? 'مضغوطة' : 'Compact'}</option></select></Field>
              <Field label={ar ? 'عرض مساحة العمل' : 'Workspace width'}><select value={admin.contentWidth} onChange={e => update('admin_ui', { contentWidth: e.target.value })}><option value="focused">{ar ? 'مركز' : 'Focused'}</option><option value="wide">{ar ? 'واسع' : 'Wide'}</option><option value="full">{ar ? 'كامل' : 'Full'}</option></select></Field>
              <Field label={ar ? 'القائمة عند فتح الإدارة' : 'Default sidebar'}><select value={admin.sidebar} onChange={e => update('admin_ui', { sidebar: e.target.value })}><option value="expanded">{ar ? 'مفتوحة' : 'Expanded'}</option><option value="collapsed">{ar ? 'مصغرة' : 'Collapsed'}</option></select></Field>
              <Field label={ar ? 'الشريط العلوي' : 'Top bar'}><select value={admin.topbar} onChange={e => update('admin_ui', { topbar: e.target.value })}><option value="sticky">{ar ? 'يثبت أثناء التمرير' : 'Sticky'}</option><option value="static">{ar ? 'غير ثابت' : 'Static'}</option></select></Field>
            </div>
            <div className="settings-v2-toggle-list compact"><Toggle checked={admin.glass !== false} onChange={() => update('admin_ui', { glass: admin.glass === false })} label={ar ? 'تأثير الزجاج في الإدارة' : 'Admin glass effect'}/><Toggle checked={admin.motion !== false} onChange={() => update('admin_ui', { motion: admin.motion === false })} label={ar ? 'حركات الإدارة' : 'Admin motion'}/></div>
          </SettingPanel>
        </>}

        {tab === 'store' && <>
          <SectionHead icon={ShoppingBag} ar={ar} eyebrow={ar ? 'تشغيل التجارة' : 'COMMERCE CONTROL'} title={ar ? 'المتجر والطلبات' : 'Store & orders'} text={ar ? 'هذه الإعدادات مرتبطة بالمتجر والسلة وحساب الطلب في الخادم، وليست مجرد شكل.' : 'These settings are wired to storefront access, cart behavior and server-side order totals.'}/>
          <SettingPanel title={ar ? 'توفر المتجر' : 'Store availability'}>
            <div className="settings-v2-toggle-list">
              <Toggle checked={store.enabled !== false} onChange={() => update('store', { enabled: store.enabled === false })} label={ar ? 'المتجر مفتوح للعملاء' : 'Store is open'} hint={ar ? 'عند إيقافه يمنع النظام التصفح وإرسال الطلب من الخادم.' : 'When off, browsing and server-side checkout are blocked.'}/>
              <Toggle checked={store.guestBrowse !== false} onChange={() => update('store', { guestBrowse: store.guestBrowse === false })} label={ar ? 'السماح للزائر بتصفح المنتجات' : 'Allow guest browsing'} />
              <Toggle checked={store.guestCart !== false} onChange={() => update('store', { guestCart: store.guestCart === false })} label={ar ? 'السماح للزائر بتجهيز السلة' : 'Allow guest cart'} hint={ar ? 'إرسال الطلب يبقى بحاجة إلى حساب لأسباب أمنية.' : 'Submitting an order still requires an account for security.'}/>
              <Toggle checked={store.showPrices !== false} onChange={() => update('store', { showPrices: store.showPrices === false })} label={ar ? 'إظهار الأسعار للعميل' : 'Show prices to customers'} />
              <Toggle checked={store.allowCoupons !== false} onChange={() => update('store', { allowCoupons: store.allowCoupons === false })} label={ar ? 'السماح بكوبونات الخصم' : 'Enable coupon codes'} hint={ar ? 'الخادم يرفض الكوبونات تلقائيًا عند إيقاف هذا الخيار.' : 'The server rejects coupons automatically when this is off.'}/>
            </div>
          </SettingPanel>
          <SettingPanel title={ar ? 'التسعير والضريبة' : 'Pricing & VAT'}>
            <div className="settings-v2-grid three">
              <Field label={ar ? 'العملة' : 'Currency'}><select value={store.currency} onChange={e => update('store', { currency: e.target.value })}><option value="SAR">SAR · {ar ? 'ريال سعودي' : 'Saudi Riyal'}</option></select></Field>
              <Field label={ar ? 'نسبة ضريبة القيمة المضافة' : 'VAT rate'} suffix="%"><input type="number" min="0" max="100" step="0.01" value={store.vatRate} onChange={e => update('store', { vatRate: Math.max(0, Number(e.target.value)) })}/></Field>
              <Field label={ar ? 'الحد الأدنى للطلب' : 'Minimum order'} suffix="SAR"><input type="number" min="0" step="1" value={store.minimumOrder} onChange={e => update('store', { minimumOrder: Math.max(0, Number(e.target.value)) })}/></Field>
            </div>
            <div className="settings-v2-toggle-list"><Toggle checked={store.pricesIncludeVat !== false} onChange={() => update('store', { pricesIncludeVat: store.pricesIncludeVat === false })} label={ar ? 'أسعار المنتجات المدخلة تشمل الضريبة' : 'Entered product prices include VAT'} hint={ar ? 'إذا أوقفتها يضيف الخادم الضريبة فوق إجمالي السلة عند إنشاء الطلب.' : 'When off, VAT is added by the server on top of the cart total.'}/></div>
            <div className="settings-v2-lock"><LockKeyhole size={17}/><div><strong>{ar ? 'إرسال الطلب يتطلب تسجيل الدخول' : 'Checkout requires sign-in'}</strong><small>{ar ? 'هذا القيد مثبت أمنيًا لأن الطلبات مرتبطة بحساب العميل ولا يمكن تعطيله من الواجهة.' : 'This is security-enforced because orders belong to a customer account and cannot be disabled in the UI.'}</small></div><span>{ar ? 'إلزامي' : 'Required'}</span></div>
          </SettingPanel>
        </>}

        {tab === 'support' && <>
          <SectionHead icon={SlidersHorizontal} ar={ar} eyebrow={ar ? 'خدمة العميل' : 'CUSTOMER CARE'} title={ar ? 'الدعم والتواصل' : 'Support & communication'} text={ar ? 'تتحكم مباشرة في زر المساعدة، الأسئلة الشائعة وقناة التذاكر.' : 'Directly controls the help widget, FAQs and tracked support tickets.'}/>
          <SettingPanel title={ar ? 'قنوات المساعدة' : 'Help channels'}>
            <div className="settings-v2-toggle-list">
              <Toggle checked={support.enabled !== false} onChange={() => update('support', { enabled: support.enabled === false })} label={ar ? 'إظهار زر المساعدة العائم' : 'Show floating help widget'} />
              <Toggle checked={support.showFaq !== false} onChange={() => update('support', { showFaq: support.showFaq === false })} label={ar ? 'إظهار الأسئلة الشائعة' : 'Show FAQs'} />
              <Toggle checked={support.signedInTickets !== false} onChange={() => update('support', { signedInTickets: support.signedInTickets === false })} label={ar ? 'السماح بتذاكر الدعم داخل الحساب' : 'Allow tracked support tickets'} hint={ar ? 'عند الإيقاف تختفي صفحة المحادثات من بوابة العميل.' : 'When off, the support tab disappears from the client portal.'}/>
              <Toggle checked={support.visitorWhatsapp !== false} onChange={() => update('support', { visitorWhatsapp: support.visitorWhatsapp === false })} label={ar ? 'إظهار واتساب داخل نافذة المساعدة' : 'Show WhatsApp inside help widget'} />
            </div>
          </SettingPanel>
        </>}

        {tab === 'notifications' && <>
          <SectionHead icon={BellRing} ar={ar} eyebrow={ar ? 'التنبيهات' : 'DELIVERY CHANNELS'} title={ar ? 'الإشعارات' : 'Notifications'} text={ar ? 'لا نعرض خيارات وهمية: القناة المفعلة فقط هي التي تعمل فعليًا الآن.' : 'No fake toggles: only connected channels are configurable.'}/>
          <SettingPanel title={ar ? 'القنوات المتاحة' : 'Available channels'}>
            <ChannelCard icon={BellRing} title={ar ? 'داخل النظام' : 'In-app'} status={ar ? 'متصل ويعمل' : 'Connected & live'} live><Toggle checked={notify.inApp !== false} onChange={() => update('notifications', { inApp: notify.inApp === false })} label={ar ? 'إظهار الإشعارات داخل حساب العميل' : 'Show notifications in client accounts'} hint={ar ? 'عند إيقافها تختفي تبويبة الإشعارات من بوابة العميل.' : 'When off, the notifications tab is hidden from the client portal.'}/></ChannelCard>
            <div className="settings-v2-channel-grid"><IntegrationCard icon={Mail} title={ar ? 'البريد الإلكتروني' : 'Email'} text={ar ? 'غير مربوط حاليًا بإرسال إشعارات النظام. رسائل Auth منفصلة.' : 'System notification delivery is not connected yet. Auth emails are separate.'}/><IntegrationCard icon={MessageCircle} title={ar ? 'واتساب Business API' : 'WhatsApp Business API'} text={ar ? 'غير مربوط بمزود API حتى الآن، لذلك لن نعرض مفتاح تشغيل وهمي.' : 'No API provider is connected yet, so there is no misleading enable switch.'}/></div>
          </SettingPanel>
        </>}

        {tab === 'security' && <>
          <SectionHead icon={ShieldCheck} ar={ar} eyebrow={ar ? 'حماية الإدارة' : 'ADMIN SECURITY'} title={ar ? 'الأمان والجلسات' : 'Security & sessions'} text={ar ? 'الإعداد الموجود هنا مطبق فعليًا على جلسة لوحة الإدارة.' : 'The setting below is actively enforced in the admin session.'}/>
          <SettingPanel title={ar ? 'القفل التلقائي للإدارة' : 'Automatic admin lock'}>
            <div className="settings-v2-toggle-list"><Toggle checked={security.adminAutoLock !== false} onChange={() => update('security', { adminAutoLock: security.adminAutoLock === false })} label={ar ? 'تسجيل خروج المدير عند عدم النشاط' : 'Sign out admin after inactivity'} hint={ar ? 'يعيد المؤقت عند الضغط أو الكتابة أو التمرير، ثم يسجل الخروج بعد المدة المحددة.' : 'Activity resets the timer; the admin is signed out after the configured idle period.'}/></div>
            <div className="settings-v2-grid two"><Field label={ar ? 'مدة عدم النشاط' : 'Idle timeout'} suffix={ar ? 'دقيقة' : 'min'}><input type="number" min="5" max="480" step="5" disabled={security.adminAutoLock === false} value={security.adminIdleMinutes} onChange={e => update('security', { adminIdleMinutes: Math.min(480, Math.max(5, Number(e.target.value) || 5)) })}/></Field><Readout label={ar ? 'صلاحية المدير' : 'Admin authorization'} value="app_metadata.role = admin" icon={ShieldCheck}/></div>
          </SettingPanel>
          <SettingPanel title={ar ? 'حالة الحماية' : 'Protection status'}>
            <div className="settings-v2-security-grid"><StatusCard good icon={ShieldCheck} title="RLS" text={ar ? 'مفعل على جداول النظام والتجارة.' : 'Enabled on system and commerce tables.'}/><StatusCard good icon={LockKeyhole} title={ar ? 'مسار الإدارة' : 'Admin route'} text={ar ? 'محمي بصلاحية admin.' : 'Protected by admin role.'}/><StatusCard icon={AlertTriangle} title={ar ? 'حماية كلمات المرور المسربة' : 'Leaked password protection'} text={ar ? 'تحتاج تفعيلها من إعدادات Supabase Auth؛ ليست خيارًا داخل قاعدة البيانات.' : 'Enable from Supabase Auth settings; it is not a database setting.'}/></div>
          </SettingPanel>
        </>}

        <div className="settings-v2-section-actions">
          <button className="admin-secondary-button" onClick={resetCurrentTab}><RotateCcw size={15}/>{ar ? 'إرجاع القيم الافتراضية' : 'Reset section defaults'}</button>
          <div><span className={currentDirty ? 'dirty' : ''}>{currentDirty ? (ar ? 'يوجد تغييرات غير محفوظة' : 'Unsaved changes') : (ar ? 'القسم محفوظ' : 'Section saved')}</span><button className="admin-primary-button" onClick={() => saveKeys(currentKeys)} disabled={!currentDirty || saving}><Save size={16}/>{saving ? (ar ? 'جاري الحفظ…' : 'Saving…') : (ar ? 'حفظ وتطبيق' : 'Save & apply')}</button></div>
        </div>
      </main>
    </div>

    {dirtyCount > 0 && <div className="settings-v2-global-save"><div><span><i/>{ar ? `${dirtyCount} مجموعة إعدادات بها تغييرات` : `${dirtyCount} settings group${dirtyCount > 1 ? 's' : ''} changed`}</span><small>{ar ? 'لن تصبح دائمة حتى تحفظها.' : 'Changes are not permanent until saved.'}</small></div><button className="admin-primary-button" onClick={() => saveKeys(Object.keys(dirty))} disabled={saving}><Save size={16}/>{ar ? 'حفظ جميع التغييرات' : 'Save all changes'}</button></div>}
  </div>;
}

function SectionHead({ icon: Icon, eyebrow, title, text }) { return <div className="settings-v2-section-head"><span><Icon size={22}/></span><div><small>{eyebrow}</small><h3>{title}</h3><p>{text}</p></div></div>; }
function SettingPanel({ title, text, children }) { return <section className="settings-v2-panel"><header><div><h4>{title}</h4>{text && <p>{text}</p>}</div></header>{children}</section>; }
function Field({ label, suffix, children }) { return <label className="settings-v2-field"><span>{label}</span><div className="settings-v2-control">{children}{suffix && <em>{suffix}</em>}</div></label>; }
function Toggle({ label, hint, checked, onChange }) { return <button type="button" className="settings-v2-toggle" onClick={onChange}><div><strong>{label}</strong>{hint && <small>{hint}</small>}</div><span className={`settings-v2-switch ${checked ? 'on' : ''}`}><i/></span></button>; }
function Readout({ label, value, icon: Icon }) { return <div className="settings-v2-readout"><span>{Icon && <Icon size={16}/>}</span><div><small>{label}</small><strong>{value}</strong></div></div>; }
function ChannelCard({ icon: Icon, title, status, live, children }) { return <div className="settings-v2-channel"><header><span><Icon size={19}/></span><div><strong>{title}</strong><small className={live ? 'live' : ''}>{live && <i/>}{status}</small></div></header>{children}</div>; }
function IntegrationCard({ icon: Icon, title, text }) { return <div className="settings-v2-integration"><span><Icon size={20}/></span><div><strong>{title}</strong><p>{text}</p></div><em>{'—'}</em></div>; }
function StatusCard({ good, icon: Icon, title, text }) { return <div className={`settings-v2-status ${good ? 'good' : 'warn'}`}><span><Icon size={18}/></span><div><strong>{title}</strong><p>{text}</p></div></div>; }
function WebsitePreview({ ar, site }) { return <div className={`settings-v2-site-preview preview-accent-${site.accent} preview-radius-${site.radius}`}><div className="preview-top"><span/><span/><span/></div><div className="preview-body"><div><small>BALQEES FLORAL</small><strong>{ar ? 'معاينة الهوية' : 'Visual preview'}</strong><p>{ar ? 'هذه معاينة سريعة لحجم الخط والاستدارة واللون المساند.' : 'Quick preview of type scale, corners and accent.'}</p><button>{ar ? 'زر نموذجي' : 'Sample action'}</button></div><div className="preview-art"><Sparkles size={24}/></div></div></div>; }
