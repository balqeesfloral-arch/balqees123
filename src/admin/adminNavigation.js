import {
  BadgePercent, Bell, Boxes, CircleHelp, ClipboardPlus, FileClock, FileText,
  Gift, Globe2, Heart, Home, LayoutDashboard, MapPinned, MessageSquareText,
  PackageSearch, ReceiptText, ScrollText, Settings, ShieldCheck, ShoppingBag,
  Sparkles, UserRoundCog, UsersRound,
} from 'lucide-react';

export const ADMIN_GROUPS = [
  { id: 'command', ar: 'مركز القيادة', en: 'Command center' },
  { id: 'commerce', ar: 'المتجر والمبيعات', en: 'Store & sales' },
  { id: 'organizations', ar: 'المنشآت والشراكات', en: 'Organizations' },
  { id: 'care', ar: 'العملاء والتواصل', en: 'Customers & care' },
  { id: 'system', ar: 'النظام والحماية', en: 'System & security' },
];

export const ADMIN_NAV = [
  { path: '/admin', icon: LayoutDashboard, ar: 'لوحة القيادة', en: 'Overview', group: 'command', end: true },
  { path: '/admin/pages', icon: Globe2, ar: 'مركز الصفحات', en: 'Page hub', group: 'command' },
  { path: '/admin/catalog', icon: Boxes, ar: 'المنتجات والتسعير', en: 'Products & pricing', group: 'commerce' },
  { path: '/admin/orders', icon: PackageSearch, ar: 'الطلبات', en: 'Orders', group: 'commerce' },
  { path: '/admin/quote-requests', icon: ClipboardPlus, ar: 'طلبات الخدمات والتسعير', en: 'Service & pricing requests', group: 'commerce' },
  { path: '/admin/discounts', icon: BadgePercent, ar: 'الخصومات', en: 'Discounts', group: 'commerce' },
  { path: '/admin/offers', icon: Gift, ar: 'العروض', en: 'Offers', group: 'commerce' },
  { path: '/admin/service-requests', icon: ClipboardPlus, ar: 'طلبات المنشآت', en: 'B2B requests', group: 'organizations' },
  { path: '/admin/quotes', icon: FileText, ar: 'عروض الأسعار', en: 'Quotations', group: 'organizations' },
  { path: '/admin/contracts', icon: ScrollText, ar: 'العقود', en: 'Contracts', group: 'organizations' },
  { path: '/admin/sites', icon: MapPinned, ar: 'المواقع والفروع', en: 'Sites & branches', group: 'organizations' },
  { path: '/admin/financial-docs', icon: ReceiptText, ar: 'المالية والمستندات', en: 'Finance & documents', group: 'organizations' },
  { path: '/admin/institutional-catalog', icon: Sparkles, ar: 'كتالوج المنشآت', en: 'Institutional catalog', group: 'organizations' },
  { path: '/admin/organization-team', icon: UsersRound, ar: 'فرق المنشآت', en: 'Organization teams', group: 'organizations' },
  { path: '/admin/organization-settings', icon: Settings, ar: 'إعدادات المنشآت', en: 'Organization settings', group: 'organizations' },
  { path: '/admin/users', icon: UsersRound, ar: 'المستخدمون', en: 'Users', group: 'care' },
  { path: '/admin/support', icon: MessageSquareText, ar: 'التواصل والعناية', en: 'Communication & care', group: 'care' },
  { path: '/admin/notifications', icon: Bell, ar: 'الإشعارات', en: 'Notifications', group: 'care' },
  { path: '/admin/help', icon: CircleHelp, ar: 'مركز المساعدة', en: 'Help center', group: 'care' },
  { path: '/admin/settings', icon: Settings, ar: 'إعدادات النظام', en: 'System settings', group: 'system' },
  { path: '/admin/audit', icon: FileClock, ar: 'سجل النشاط', en: 'Activity log', group: 'system' },
  { path: '/admin/profile', icon: UserRoundCog, ar: 'حساب المدير', en: 'Admin account', group: 'system' },
];

// Customer routes keep their existing account and organization permission gates.
// Each entry points to the relevant administration module, without impersonation.
export const PAGE_GROUPS = [
  { id: 'website', ar: 'الموقع العام', en: 'Public website' },
  { id: 'individual', ar: 'بوابة الأفراد', en: 'Individual portal' },
  { id: 'organization', ar: 'بوابة المنشآت', en: 'Organization portal' },
];
const page = (path, ar, en, icon, manage, group, preview = false) => ({ path, ar, en, icon, manage, group, preview });
export const CONNECTED_PAGES = [
  page('/', 'الرئيسية', 'Home', Home, '/admin/settings?tab=general', 'website', true),
  page('/services', 'الخدمات', 'Services', Sparkles, '/admin/quote-requests', 'website', true),
  page('/request-quote', 'طلب عرض سعر ومتابعته', 'Request & track a quotation', ClipboardPlus, '/admin/quote-requests', 'website', true),
  page('/store', 'المتجر والمنتجات', 'Store & products', ShoppingBag, '/admin/catalog', 'website', true),
  page('/projects', 'الأعمال', 'Projects', Globe2, '/admin/settings?tab=appearance', 'website', true),
  page('/about', 'عن بلقيس', 'About Balqees', Home, '/admin/settings?tab=general', 'website', true),
  page('/certification', 'الاعتماد', 'Certification', ShieldCheck, '/admin/settings?tab=general', 'website', true),
  page('/account', 'الدخول والحسابات', 'Sign in & accounts', UsersRound, '/admin/users', 'website', true),
  page('/signup', 'إنشاء حساب', 'Registration', UserRoundCog, '/admin/users', 'website', true),
  page('/account', 'لوحة العميل الفردي', 'Customer home', LayoutDashboard, '/admin/users', 'individual'),
  page('/account/orders', 'طلبات الأفراد ومركز الطلب', 'Orders & order center', PackageSearch, '/admin/orders', 'individual'),
  page('/account/cart', 'سلة العميل', 'Customer cart', ShoppingBag, '/admin/catalog', 'individual'),
  page('/account/favorites', 'المفضلة', 'Favorites', Heart, '/admin/catalog', 'individual'),
  page('/account/addresses', 'العناوين والمستلمون', 'Addresses & recipients', MapPinned, '/admin/users', 'individual'),
  page('/account/occasions', 'المناسبات', 'Occasions', Gift, '/admin/offers', 'individual'),
  page('/store', 'المتجر الذكي وتفاصيل المنتج', 'Smart store & product details', Boxes, '/admin/catalog', 'individual'),
  page('/checkout', 'إتمام الطلب وتأكيد المستلم', 'Checkout & recipient confirmation', ReceiptText, '/admin/orders', 'individual'),
  page('/account/support', 'عناية بلقيس', 'Balqees Care', MessageSquareText, '/admin/support', 'individual'),
  page('/account/notifications', 'إشعارات الأفراد', 'Customer notifications', Bell, '/admin/notifications', 'individual'),
  page('/account/profile', 'الملف الشخصي', 'Customer profile', UserRoundCog, '/admin/users', 'individual'),
  page('/account/settings', 'الإعدادات', 'Customer settings', Settings, '/admin/settings', 'individual'),
  page('/account/settings/security', 'الأمان والخصوصية', 'Security & privacy', ShieldCheck, '/admin/settings?tab=security', 'individual'),
  page('/account/documents', 'مستندات الأفراد', 'Customer documents', FileText, '/admin/orders', 'individual'),
  page('/portal', 'لوحة المنشأة', 'Organization home', LayoutDashboard, '/admin/users', 'organization'),
  page('/portal/orders', 'العمليات والطلبات', 'Operations & orders', PackageSearch, '/admin/orders', 'organization'),
  page('/portal/request', 'الطلب الذكي', 'Smart request', ClipboardPlus, '/admin/service-requests', 'organization'),
  page('/portal/quotes', 'غرفة عروض الأسعار', 'Quotation room', FileText, '/admin/quotes', 'organization'),
  page('/portal/contracts', 'العقود الحية', 'Living contracts', ScrollText, '/admin/contracts', 'organization'),
  page('/portal/sites', 'المواقع والفروع', 'Sites & branches', MapPinned, '/admin/sites', 'organization'),
  page('/portal/catalog', 'الكتالوج المؤسسي', 'Institutional catalog', Boxes, '/admin/institutional-catalog', 'organization'),
  page('/portal/financial', 'المالية والمستندات', 'Finance & documents', ReceiptText, '/admin/financial-docs', 'organization'),
  page('/portal/team', 'الفريق والصلاحيات', 'Team & permissions', UsersRound, '/admin/organization-team', 'organization'),
  page('/portal/support', 'العناية الذكية', 'Smart care', MessageSquareText, '/admin/support', 'organization'),
  page('/portal/notifications', 'مركز الإشعارات', 'Notification center', Bell, '/admin/notifications', 'organization'),
  page('/portal/settings', 'إعدادات المنشأة', 'Organization settings', Settings, '/admin/organization-settings', 'organization'),
  page('/portal/cart', 'السلة المؤسسية', 'Organization cart', ShoppingBag, '/admin/institutional-catalog', 'organization'),
];

export function matchesPage(item, query) {
  const normalize = value => String(value || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/[ًٌٍَُِّْـ]/g, '').trim();
  return normalize(`${item.ar} ${item.en} ${item.path}`).includes(normalize(query));
}
