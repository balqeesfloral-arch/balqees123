import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell, BellRing, Check, ChevronLeft, ChevronRight, CircleAlert, CircleCheck,
  Eye, FileText, Globe2, Heart, Home, Languages, LoaderCircle, LogOut, MapPin, PackageOpen,
  RefreshCw, RotateCcw, Settings2, ShieldCheck, ShoppingBag, SlidersHorizontal,
  Sparkles, Store, TextCursorInput, UserRound, WandSparkles, Zap,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { supabase } from '../lib/supabase';
import { useBalqeesCart } from '../lib/cart';
import {
  CUSTOMER_PREFERENCE_DEFAULTS,
  cacheCustomerPreferences,
  normalizeCustomerPreferences,
} from '../lib/customerPreferences';
import { addressText } from './individualUtils';
import './individual-account.css';

const FONT_SCALES = [
  { value: 0.9, ar: 'صغير', en: 'Small', hint: '90%' },
  { value: 1, ar: 'مريح', en: 'Comfort', hint: '100%' },
  { value: 1.15, ar: 'كبير', en: 'Large', hint: '115%' },
  { value: 1.3, ar: 'أكبر', en: 'Larger', hint: '130%' },
  { value: 1.5, ar: 'سهولة قراءة', en: 'Readable', hint: '150%' },
];

function Toggle({ checked, onChange, disabled = false, label }) {
  return <button type="button" className={`individual-settings-toggle ${checked ? 'on' : ''}`} aria-pressed={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}><span/></button>;
}

function SettingRow({ icon: Icon, title, description, children, tone = '' }) {
  return <div className={`individual-settings-row ${tone}`}>
    <span className="individual-settings-row-icon"><Icon size={18}/></span>
    <div className="individual-settings-row-copy"><strong>{title}</strong>{description && <small>{description}</small>}</div>
    <div className="individual-settings-row-action">{children}</div>
  </div>;
}

function Section({ kicker, title, description, children }) {
  return <section className="individual-settings-section"><div className="individual-settings-section-head"><span>{kicker}</span><h2>{title}</h2>{description && <p>{description}</p>}</div><div className="individual-settings-list">{children}</div></section>;
}

export default function IndividualSettings({ lang, setLang, session, onSignOut }) {
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const Arrow = ar ? ChevronLeft : ChevronRight;
  const uid = session?.user?.id;
  const cart = useBalqeesCart(uid || null);
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(normalizeCustomerPreferences());
  const [addresses, setAddresses] = useState([]);
  const [hasPreferenceRow, setHasPreferenceRow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState(null);
  const [customNotifications, setCustomNotifications] = useState(false);

  useEffect(() => {
    document.body.classList.add('individual-account-active');
    return () => document.body.classList.remove('individual-account-active');
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const id = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(id);
  }, [notice]);

  async function load(silent = false) {
    if (!supabase || !uid) return;
    silent ? setRefreshing(true) : setLoading(true);
    const [profileResult, prefResult, addressResult] = await Promise.all([
      supabase.from('customer_profiles').select('full_name,username').eq('id', uid).maybeSingle(),
      supabase.from('customer_preferences').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('customer_addresses').select('*').eq('user_id', uid).eq('is_active', true).order('is_default', { ascending: false }).order('updated_at', { ascending: false }),
    ]);
    setProfile(profileResult.data || null);
    setHasPreferenceRow(!!prefResult.data);
    const next = normalizeCustomerPreferences(prefResult.data || {});
    setPreferences(next);
    cacheCustomerPreferences(uid, next);
    setAddresses(addressResult.data || []);
    setLoading(false); setRefreshing(false);
  }

  useEffect(() => { load(); }, [uid]);

  const fullName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || (ar ? 'عميل بلقيس' : 'Balqees client');
  const firstName = fullName.trim().split(/\s+/)[0];
  const defaultAddress = useMemo(() => addresses.find(x => x.id === preferences.default_address_id) || addresses.find(x => x.is_default) || addresses[0] || null, [addresses, preferences.default_address_id]);

  const notificationMode = useMemo(() => {
    if (!preferences.marketing_in_app && !preferences.occasion_reminders) return 'essential';
    if (!preferences.marketing_in_app && preferences.occasion_reminders) return 'balanced';
    return 'custom';
  }, [preferences.marketing_in_app, preferences.occasion_reminders]);

  async function savePatch(patch, key = 'settings', successText = null) {
    if (!supabase || !uid || saving) return false;
    setSaving(key);
    const payload = { ...patch, updated_at: new Date().toISOString() };
    const request = hasPreferenceRow
      ? supabase.from('customer_preferences').update(payload).eq('user_id', uid).select('*').maybeSingle()
      : supabase.from('customer_preferences').insert({ user_id: uid, ...CUSTOMER_PREFERENCE_DEFAULTS, ...patch }).select('*').maybeSingle();
    const { data, error } = await request;
    setSaving('');
    if (error) {
      setNotice({ type: 'error', text: ar ? 'تعذر حفظ الإعداد الآن. حاول مرة أخرى.' : 'Could not save this setting. Try again.' });
      return false;
    }
    setHasPreferenceRow(true);
    const next = normalizeCustomerPreferences(data || { ...preferences, ...patch });
    setPreferences(next);
    cacheCustomerPreferences(uid, next);
    if (patch.preferred_language && setLang) setLang(patch.preferred_language);
    if (successText) setNotice({ type: 'success', text: successText });
    return true;
  }

  async function setNotificationMode(mode) {
    if (mode === 'custom') { setCustomNotifications(true); return; }
    setCustomNotifications(false);
    if (mode === 'essential') {
      await savePatch({
        marketing_in_app: false,
        occasion_reminders: false,
        greeting_messages: false,
        winback_messages: false,
        abandoned_cart_messages: false,
        price_drop_alerts: false,
        back_in_stock_alerts: false,
      }, 'notifications', ar ? 'تم ضبط الإشعارات على الضرورية فقط.' : 'Notifications set to essential only.');
      return;
    }
    await savePatch({
      marketing_in_app: false,
      occasion_reminders: true,
      greeting_messages: false,
      winback_messages: false,
      abandoned_cart_messages: false,
      price_drop_alerts: false,
      back_in_stock_alerts: false,
    }, 'notifications', ar ? 'تم ضبط الإشعارات على الوضع المتوازن.' : 'Notifications set to balanced.');
  }

  async function setDefaultAddress(addressId) {
    if (!addressId) return;
    setSaving('address');
    const { error } = await supabase.rpc('customer_set_default_address', { p_address_id: addressId });
    setSaving('');
    if (error) return setNotice({ type: 'error', text: ar ? 'تعذر تغيير العنوان الافتراضي.' : 'Could not change the default address.' });
    const next = { ...preferences, default_address_id: addressId };
    setPreferences(next); cacheCustomerPreferences(uid, next);
    setAddresses(rows => rows.map(row => ({ ...row, is_default: row.id === addressId })));
    setNotice({ type: 'success', text: ar ? 'تم تحديث العنوان الافتراضي.' : 'Default address updated.' });
  }

  async function clearPersonalizationHistory() {
    setSaving('clear-interest');
    const { error } = await supabase.from('customer_interest_events').delete().eq('user_id', uid);
    setSaving('');
    if (error) return setNotice({ type: 'error', text: ar ? 'تعذر مسح سجل التخصيص.' : 'Could not clear personalization history.' });
    setNotice({ type: 'success', text: ar ? 'تم مسح سجل التصفح المستخدم للتخصيص. الطلبات والمفضلة لم تتغير.' : 'Personalization browsing history was cleared. Orders and favorites were not changed.' });
  }

  async function resetInterface() {
    await savePatch({ font_scale: 1, reduce_motion: false, quiet_mode: false }, 'reset', ar ? 'رجعت إعدادات الواجهة للوضع الافتراضي بدون تغيير اختيارات الخصوصية أو التسويق.' : 'Interface settings were reset without changing privacy or marketing choices.');
  }

  if (loading) return <div className="individual-page"><div className="individual-center-state"><LoaderCircle className="spin"/><strong>{ar ? 'نجهز إعداداتك…' : 'Preparing your settings…'}</strong></div></div>;

  return <div className="individual-page individual-settings-page" dir={ar ? 'rtl' : 'ltr'}>
    <header className="individual-topbar"><div className="individual-shell individual-topbar-inner">
      <Link to="/" className="individual-brand"><BrandMark/></Link>
      <div className="individual-topbar-center"><span>{ar ? 'الإعدادات' : 'SETTINGS'}</span><small>{ar ? 'حساب فردي' : 'INDIVIDUAL ACCOUNT'}</small></div>
      <div className="individual-top-actions"><button type="button" className="individual-icon-button" onClick={()=>navigate('/account/notifications')}><Bell size={19}/></button><button type="button" className="individual-icon-button" onClick={()=>navigate('/account/cart')}><ShoppingBag size={19}/>{cart.count>0&&<b>{Math.min(cart.count,99)}</b>}</button><button type="button" className="individual-profile-chip" onClick={()=>navigate('/account/profile')}><span>{fullName.slice(0,1).toUpperCase()}</span><div><small>{ar ? 'مرحبًا' : 'Welcome'}</small><strong>{firstName}</strong></div></button></div>
    </div></header>

    <main className="individual-shell individual-settings-main">
      {notice && <div className={`individual-inline-notice ${notice.type}`}>{notice.type === 'success' ? <CircleCheck/> : <CircleAlert/>}<span>{notice.text}</span></div>}
      <section className="individual-settings-hero">
        <div><span><Settings2 size={15}/>{ar ? 'تجربتك على طريقتك' : 'YOUR EXPERIENCE, YOUR WAY'}</span><h1>{ar ? 'الإعدادات' : 'Settings'}</h1><p>{ar ? 'كل خيار هنا يغيّر سلوكًا حقيقيًا في حسابك. الأشياء الضرورية مثل حالة الطلب والأمان وردود فريق بلقيس تظل تصل لك دائمًا.' : 'Every option here changes real account behavior. Essential order, security and Balqees Care updates always remain available.'}</p></div>
        <button type="button" className="individual-refresh" onClick={()=>load(true)} disabled={refreshing}><RefreshCw className={refreshing?'spin':''}/><span>{ar ? 'تحديث' : 'Refresh'}</span></button>
      </section>

      <Section kicker={ar ? 'اللغة' : 'LANGUAGE'} title={ar ? 'اللغة والمنطقة' : 'Language & region'} description={ar ? 'تُحفظ اللغة على حسابك وتظهر نفسها عند دخولك من جهاز آخر.' : 'Your language is saved to your account and follows you across devices.'}>
        <SettingRow icon={Languages} title={ar ? 'لغة الواجهة' : 'Interface language'} description={ar ? 'تتغير فورًا وتُحفظ في Supabase.' : 'Changes immediately and is saved in Supabase.'}>
          <div className="individual-settings-segment"><button className={preferences.preferred_language==='ar'?'active':''} onClick={()=>savePatch({ preferred_language:'ar' },'language')}>العربية</button><button className={preferences.preferred_language==='en'?'active':''} onClick={()=>savePatch({ preferred_language:'en' },'language')}>English</button></div>
        </SettingRow>
        <SettingRow icon={Globe2} title={ar ? 'التاريخ والوقت' : 'Date & time'} description={ar ? 'يعتمد حسابك توقيت السعودية، وتظهر التواريخ حسب لغة الواجهة.' : 'Your account uses Saudi time; dates follow your interface language.'}><span className="individual-settings-static">Asia/Riyadh</span></SettingRow>
      </Section>

      <div id="settings-notifications"><Section kicker={ar ? 'الإشعارات' : 'NOTIFICATIONS'} title={ar ? 'ما الذي تريد أن نخبرك به؟' : 'What should Balqees tell you?'} description={ar ? 'الطلب، الأمان، الدفع وردود مركز العناية ضرورية ولا يتم تعطيلها.' : 'Order, security, payment and care-center updates are essential and cannot be disabled.'}>
        <div className="individual-settings-presets">
          <button className={notificationMode==='essential'&&!customNotifications?'active':''} onClick={()=>setNotificationMode('essential')}><ShieldCheck/><strong>{ar ? 'الضرورية فقط' : 'Essential only'}</strong><small>{ar ? 'الطلبات والأمان والدعم' : 'Orders, security & support'}</small></button>
          <button className={notificationMode==='balanced'&&!customNotifications?'active':''} onClick={()=>setNotificationMode('balanced')}><BellRing/><strong>{ar ? 'متوازنة' : 'Balanced'}</strong><small>{ar ? 'الضرورية + المناسبات المحفوظة' : 'Essential + saved occasions'}</small></button>
          <button className={customNotifications||notificationMode==='custom'?'active':''} onClick={()=>setNotificationMode('custom')}><SlidersHorizontal/><strong>{ar ? 'مخصصة' : 'Custom'}</strong><small>{ar ? 'تحكم في الخيارات المتاحة' : 'Choose available options'}</small></button>
        </div>
        {(customNotifications || notificationMode==='custom') && <div className="individual-settings-custom">
          <SettingRow icon={Sparkles} title={ar ? 'العروض داخل الموقع' : 'In-app offers'} description={ar ? 'يعرض الحملات والعروض داخل الرئيسية والإشعارات. لا يشمل تحديثات الطلب.' : 'Shows campaigns and offers in your home and notifications. Order updates are unaffected.'}><Toggle checked={preferences.marketing_in_app&&!preferences.quiet_mode} disabled={preferences.quiet_mode} label="marketing" onChange={value=>savePatch({ marketing_in_app:value },'marketing')}/></SettingRow>
          <SettingRow icon={BellRing} title={ar ? 'تذكيرات المناسبات المحفوظة' : 'Saved occasion reminders'} description={ar ? 'تذكيرات داخل الحساب فقط للمناسبات التي حفظتها أنت.' : 'In-account reminders only for occasions you saved.'}><Toggle checked={preferences.occasion_reminders&&!preferences.quiet_mode} disabled={preferences.quiet_mode} label="occasions" onChange={value=>savePatch({ occasion_reminders:value },'occasions')}/></SettingRow>
          <div className="individual-settings-unavailable"><Bell/><div><strong>{ar ? 'البريد وWhatsApp التسويقي غير معروضين' : 'Marketing email and WhatsApp are not shown'}</strong><p>{ar ? 'لن نعرض قناة تشغيل وهمية قبل ربط مزود إرسال رسمي.' : 'We do not expose a fake toggle before an official delivery provider is connected.'}</p></div></div>
        </div>}
      </Section>

      </div>
      <Section kicker={ar ? 'التخصيص' : 'PERSONALIZATION'} title={ar ? 'تخصيص المتجر' : 'Store personalization'} description={ar ? 'التخصيص يغيّر ترتيب الاقتراحات فقط؛ لا يخفي بقية المتجر ولا يغيّر الأسعار.' : 'Personalization changes recommendation ordering only; it never hides the rest of the store or changes prices.'}>
        <SettingRow icon={WandSparkles} title={ar ? 'تحسين الاقتراحات بناءً على استخدامي' : 'Improve recommendations from my activity'} description={preferences.personalized_recommendations ? (ar ? 'المفضلة، السلة، التصفح والشراء تساعد في ترتيب «مختارات لك».' : 'Favorites, cart, browsing and purchases help rank “For you”.') : (ar ? 'المتجر يستخدم ترتيبًا عامًا ولا يسجل إشارات تخصيص جديدة.' : 'The store uses general ranking and does not record new personalization signals.')}><Toggle checked={preferences.personalized_recommendations} label="personalization" onChange={value=>savePatch({ personalized_recommendations:value },'personalization')}/></SettingRow>
        <SettingRow icon={RotateCcw} title={ar ? 'مسح سجل التصفح المستخدم للتخصيص' : 'Clear personalization browsing history'} description={ar ? 'يمسح إشارات المشاهدة والسلة المستخدمة للترتيب. لا يحذف الطلبات أو المفضلة.' : 'Clears behavioral ranking signals. Orders and favorites remain untouched.'}><button className="individual-settings-text-button" type="button" disabled={saving==='clear-interest'} onClick={clearPersonalizationHistory}>{saving==='clear-interest' ? <LoaderCircle className="spin"/> : <RotateCcw/>}{ar ? 'مسح السجل' : 'Clear history'}</button></SettingRow>
      </Section>

      <Section kicker={ar ? 'الراحة' : 'COMFORT'} title={ar ? 'المظهر والراحة' : 'Appearance & comfort'} description={ar ? 'تُطبق هذه الخيارات على حسابك والمتجر أثناء تسجيل دخولك.' : 'These options apply across your account and store while you are signed in.'}>
        <SettingRow icon={TextCursorInput} title={ar ? 'حجم الواجهة والقراءة' : 'Interface & reading size'} description={ar ? 'تكبير حقيقي للنصوص والأزرار والمسافات، وليس فرقًا شكليًا صغيرًا.' : 'Real scaling of text, controls and spacing—not a cosmetic one-pixel change.'}>
          <div className="individual-settings-scale">{FONT_SCALES.map(item=><button key={item.value} title={ar?item.ar:item.en} className={Number(preferences.font_scale)===item.value?'active':''} onClick={()=>savePatch({ font_scale:item.value },'font-scale')}><strong>{item.hint}</strong><small>{ar?item.ar:item.en}</small></button>)}</div>
        </SettingRow>
        <SettingRow icon={Zap} title={ar ? 'تقليل المؤثرات والحركة' : 'Reduce effects & motion'} description={ar ? 'يوقف الحركات الثقيلة والـparallax وانتقالات الواجهة القوية.' : 'Reduces heavy animation, parallax and strong transitions.'}><Toggle checked={preferences.reduce_motion} label="reduce motion" onChange={value=>savePatch({ reduce_motion:value },'motion')}/></SettingRow>
        <SettingRow icon={Eye} title={ar ? 'الوضع الهادئ' : 'Quiet mode'} description={ar ? 'يخفف الحركة ويخفي الحملات والعروض والتنبيهات غير الضرورية. الطلب والأمان وردود بلقيس لا تتأثر.' : 'Reduces motion and hides campaigns, offers and non-essential alerts. Orders, security and Balqees Care are unaffected.'} tone="quiet"><Toggle checked={preferences.quiet_mode} label="quiet mode" onChange={value=>savePatch({ quiet_mode:value },'quiet')}/></SettingRow>
      </Section>

      <Section kicker={ar ? 'الطلبات' : 'ORDERS'} title={ar ? 'اختصارات الطلب' : 'Order shortcuts'} description={ar ? 'نحتفظ هنا فقط بما يعمل فعليًا الآن.' : 'Only controls that work today are shown here.'}>
        <SettingRow icon={MapPin} title={ar ? 'العنوان الافتراضي' : 'Default address'} description={defaultAddress ? addressText(defaultAddress, ar) : (ar ? 'لا يوجد عنوان محفوظ بعد.' : 'No saved address yet.')}>
          {addresses.length ? <select className="individual-settings-select" value={defaultAddress?.id || ''} onChange={e=>setDefaultAddress(e.target.value)} disabled={saving==='address'}>{addresses.map(address=><option key={address.id} value={address.id}>{address.label || addressText(address, ar)}</option>)}</select> : <Link className="individual-settings-inline-link" to="/account/addresses">{ar ? 'إضافة عنوان' : 'Add address'}<Arrow/></Link>}
        </SettingRow>
        <SettingRow icon={FileText} title={ar ? 'مستنداتي' : 'My documents'} description={ar ? 'ملخصات طلباتك والفواتير الرسمية في خزنة واحدة مرتبطة بالطلبات.' : 'Your order summaries and official invoices in one vault linked to your orders.'}><Link className="individual-settings-inline-link" to="/account/documents">{ar ? 'فتح المستندات' : 'Open documents'}<Arrow/></Link></SettingRow>
      </Section>

      <Section kicker={ar ? 'الأمان والخصوصية' : 'SECURITY & PRIVACY'} title={ar ? 'تحكم واضح، بدون نسخ البيانات هنا' : 'Clear controls without duplicating your data'}>
        <SettingRow icon={ShieldCheck} title={ar ? 'مركز الأمان والخصوصية' : 'Security & Privacy center'} description={ar ? 'كلمة المرور، التحقق بخطوتين، Passkeys، الجلسات، نشاط الأمان، وبياناتك — كلها تحت الإعدادات.' : 'Password, 2FA, Passkeys, sessions, security activity and your data — all inside Settings.'}><Link className="individual-settings-inline-link" to="/account/settings/security">{ar ? 'فتح المركز' : 'Open center'}<Arrow/></Link></SettingRow>
        <SettingRow icon={UserRound} title={ar ? 'بياناتي وخصوصيتي' : 'My data & privacy'} description={ar ? 'إدارة التخصيص وطلبات نسخة البيانات أو حذف الحساب بشكل موثق.' : 'Manage personalization, data-copy requests, and documented account-deletion requests.'}><Link className="individual-settings-inline-link" to="/account/settings/security/privacy">{ar ? 'إدارة الخصوصية' : 'Manage privacy'}<Arrow/></Link></SettingRow>
      </Section>

      <Section kicker={ar ? 'خيارات متقدمة' : 'ADVANCED'} title={ar ? 'الحساب والواجهة' : 'Account & interface'}>
        <SettingRow icon={RotateCcw} title={ar ? 'إعادة إعدادات الواجهة' : 'Reset interface settings'} description={ar ? 'يرجع الحجم والحركة والوضع الهادئ فقط. لا يغيّر التسويق أو التخصيص.' : 'Resets size, motion and quiet mode only. Marketing and privacy choices remain unchanged.'}><button type="button" className="individual-settings-text-button" onClick={resetInterface} disabled={saving==='reset'}>{saving==='reset'?<LoaderCircle className="spin"/>:<RotateCcw/>}{ar ? 'إعادة' : 'Reset'}</button></SettingRow>
        <SettingRow icon={LogOut} title={ar ? 'تسجيل الخروج من هذا الجهاز' : 'Sign out of this device'} description={ar ? 'لا يسجل خروج الأجهزة الأخرى.' : 'Other devices stay signed in.'} tone="danger"><button type="button" className="individual-settings-text-button danger" onClick={onSignOut}><LogOut/>{ar ? 'تسجيل الخروج' : 'Sign out'}</button></SettingRow>
      </Section>
    </main>

    <nav className="individual-mobile-dock"><Link to="/account"><Home/><span>{ar ? 'الرئيسية' : 'Home'}</span></Link><Link to="/account/orders"><PackageOpen/><span>{ar ? 'طلباتي' : 'Orders'}</span></Link><Link to="/store"><Store/><span>{ar ? 'المتجر' : 'Store'}</span></Link><Link to="/account/favorites"><Heart/><span>{ar ? 'المفضلة' : 'Favorites'}</span></Link><Link className="active" to="/account/profile"><UserRound/><span>{ar ? 'حسابي' : 'Account'}</span></Link></nav>
  </div>;
}
