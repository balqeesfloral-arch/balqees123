# بلقيس الورد — نسخة المواسم التفاعلية 5.1

## طلبات عروض الأسعار عبر واتساب

بعد حفظ الطلب في Supabase، يفتح العميل رسالة جاهزة للمبيعات بالمنتجات والكميات ورابط RFQ. تفتح المبيعات الرابط بحساب الإدارة لتسجيل السعر من الجوال، ويظهر العرض في حساب العميل. الإرسال يدوي دون اشتراك WhatsApp API. تفاصيل الاستخدام والتحقق في [WHATSAPP-QUOTATIONS.md](WHATSAPP-QUOTATIONS.md).

## v10.48.0 — الخدمات وطلبات عروض الأسعار

عقود الورد الأسبوعية والشهرية والصيانة ترسل طلب عرض سعر إلى قسم «طلبات الخدمات والتسعير» عند المدير، مع رد وإشعارات للعميل. الكتالوج يدعم الشجر والورد والمراكن، واختيار سعر محدد أو طلب عرض سعر لكل منتج. سلة المنتجات المتغيرة السعر تنتقل إلى التسعير. تفاصيل الربط والفحص في [SERVICES-QUOTATIONS-v10.48.md](SERVICES-QUOTATIONS-v10.48.md).

## v10.47.0 — مركز قيادة مدير النظام والمتجر

لوحة عربية RTL بهوية بلقيس الزيتونية والذهبية، ومركز يصل 35 وجهة في الموقع وبوابات العملاء بأقسام إدارتها، مع بيانات فعلية ورسائل للأخطاء. المنتجات والتكلفة تحفظ في معاملة واحدة، والتغييرات تنعكس عبر التحديث الحي. المتجر الحالي مفعّل وتفاصيل المنتجات مرتبطة بالكتالوج المركزي. تفاصيل التطبيق والاختبارات في [ADMIN-COMMAND-CENTER-v10.47.md](ADMIN-COMMAND-CENTER-v10.47.md).


موقع React + Vite ثنائي اللغة، بتصميم فوتوغرافي للمواسم الستة: الأساسي، رمضان، عيد الفطر، عيد الأضحى، الحج، واليوم الوطني.


## تحديث v10.44 — Production Hardening

جولة تصحيح إنتاجية شاملة بعد فحص السجل الحي وSupabase Advisors: إصلاح schema/RPC drift لصفحات المنشآت 9–12، إغلاق RPCs القديمة، تحسين RLS والفهارس، تصحيح Smart Care للطلبات، حفظ حالة الأجهزة، وإضافة بوابة تحقق مصدرية قبل البيلد. راجع `SUPABASE-v10.44-PRODUCTION-HARDENING.sql` و`VALIDATION-v10.44-PRODUCTION-HARDENING.md`.

## تحديث v10.43 — جولة QA وتكامل بوابة المنشآت 1–12

جولة اعتماد شاملة لبوابة المنشآت: توحيد التنقل إلى 12 صفحة حسب الخطة، صلاحيات الواجهة والمسارات، Deep Links، تسجيل الخروج المحلي، روابط الكتالوج المؤسسي، حالات القراءة فقط، تنظيف رفع الشعارات/ملفات المواقع، Storage hardening، وتصحيح Runtime جانبي في صفحة المفضلة الفردية. راجع `B2B-QA-INTEGRATION-v10.43.md` و`VALIDATION-v10.43-B2B-PORTAL-QA-INTEGRATION.md`.


## تحديث v10.32 — بوابة المنشآت / الصفحة الثالثة

أضيف **Smart Request Wizard** فعلي للمنشآت والفنادق، مربوط بـSupabase وPrivate Storage ولوحة المدير. راجع `VALIDATION-v10.32-B2B-SMART-REQUEST-PAGE-3.md` و`SUPABASE-v10.32-B2B-SMART-REQUESTS.sql` للتفاصيل.

## التشغيل على جهازك

ثبّت Node.js بإصدار يدعمه Vite 8 (20.19+ أو 22.12+)، وافتح Terminal داخل هذا المجلد، ثم:

```bash
npm install
npm run dev
```

افتح الرابط الذي يظهر في Terminal. لا تفتح `index.html` مباشرة؛ المشروع يحتاج خادم Vite.

## البناء والنشر

```bash
npm run build
npm run preview
```

بعد نجاح البناء ينتج مجلد `dist`. عند النشر على Vercel: أمر البناء `npm run build`، ومجلد الإخراج `dist`، وملف `vercel.json` مرفق لدعم روابط الصفحات.

## تجربة المواسم

- زر **المواسم** أعلى الصفحة يعرض المشاهد الستة.
- شريط **حكايات المواسم** أسفل الواجهة يبدّل التصميم مباشرة.
- خيار **تلقائي حسب الموسم** يعيد اكتشاف الموسم وفق توقيت الرياض وتقويم أم القرى المدعوم في المتصفح.
- المعاينة اليدوية تبقى أثناء الجلسة والتنقل بين الصفحات.
- المواسم تعمل تلقائيًا حسب تاريخ مكة المكرمة (Umm al-Qura / Asia-Riyadh). لا توجد أزرار معاينة أو تبديل يدوي في نسخة الإطلاق.
- الحالات المدعومة: الأساسي، رمضان، عيد الفطر، عيد الأضحى، موسم الحج، واليوم الوطني.

## التفاعل

- تنقل زجاجي ثابت مع تفاعل هادئ للمؤشر على الكمبيوتر.
- عنصر موسمي بخامات فوتوغرافية يبدأ حركته عند اللمس ثم يعرض الرسالة. يظهر عائمًا على الشاشات الكبيرة، وداخل الشريط الزجاجي على الجوال والتابلت والشاشات القصيرة حتى تبقى أزرار المحتوى واضحة.
- إغلاق بطاقات المواسم بالضغط خارجها أو بمفتاح Escape.
- انتقالات لطيفة، مع احترام إعداد تقليل الحركة.
- الصور والخطوط مستضافة محليًا ضمن المشروع.

## العناصر الموسمية

| الموسم | التفاعل عند اللمس |
| --- | --- |
| الأساسي | برعم روز يتفتح تدريجيًا |
| رمضان | فانوس مطفأ يضيء بضوء دافئ |
| عيد الفطر | مدفع احتفالي يرتد بخفة ويطلق التهنئة مع ومضة ودخان خفيف |
| عيد الأضحى | علبة هدية تنفتح على ورد وتمر |
| الحج | طائرة تقلع مع أثر طيران هادئ |
| اليوم الوطني | دلة تميل وتصب القهوة في فنجان |

الضغط مرة أخرى يغلق الرسالة ويعيد العنصر لحالته الأولى. تتوقف الرسالة المؤجلة عند تغيير الموسم أو الصفحة، ويحترم الموقع إعداد تقليل الحركة. لا تُشغَّل أصوات تلقائية.

## الصفحات

الرئيسية، الخدمات، الأعمال، عن بلقيس، الحساب، والاعتماد. بيانات المؤسسة وكتالوج الخدمات والباقات محفوظة. رقم واتساب الأساسي لجميع الأزرار والطلبات هو **0599076267**؛ يُحوَّل في الروابط إلى `966599076267`. يُعدَّل مركزيًا في `business.whatsapp` داخل `src/lib/content.js`.

بوابة الحسابات مربوطة بـ Supabase Auth وتدعم تسجيل الدخول، إنشاء الحساب، تأكيد البريد، تسجيل الخروج واستعادة كلمة المرور. ضع القيم العامة الصحيحة في `.env` وفق `.env.example`، واضبط Redirect URLs في Supabase وفق `AUTH-SETUP.md`. لا تضع مفتاح service role في الواجهة.

## الملفات المهمة

- `src/lib/season-design.js`: الصور والنصوص الموسمية بالعربية والإنجليزية.
- `src/lib/season.js`: قواعد اكتشاف الموسم الأصلية.
- `src/components/Layout.jsx`: الهوية العامة، اللغات، التنقل، ومعاينة المواسم.
- `src/pages/Home.jsx`: الصفحة الرئيسية.
- `src/styles.css`: الهوية المتجاوبة لكل الصفحات.
- `src/season-interactions.css`: تحريك العناصر، إصلاح حواف الصور وتوزيع الواجهة العريضة.
- `src/components/SeasonObject.jsx`: العناصر الموسمية وحالاتها الفوتوغرافية.
- `src/components/SeasonMessageWidget.jsx`: دورة التفاعل والرسائل وإلغاء المؤقتات.
- `INTERACTION-PROMPTS.md`: وصف الأصول الجديدة ومصادرها.
- `ASSET-SOURCES.md`: مصدر الصور والمراجع البصرية.
- `VALIDATION.md`: الفحوص المنفذة وحدودها.

الصور في أقسام الأعمال والخدمات هي الصور الموجودة في مشروعك. صور الواجهة الموسمية الفنية موثقة في ملف المصادر؛ لا تُقدَّم على أنها أعمال منفذة للعملاء.

## v10.7.0 — Admin Control Center

A protected `/admin` workspace is now included. Access is granted only when the signed-in Supabase user has `app_metadata.role = "admin"`.

Admin modules included:
- Smart overview dashboard
- Customer / user management
- Orders foundation
- Products and categories
- Discounts
- Offers and campaigns
- In-app notifications
- Client communication inbox
- FAQ / Help Center editor
- System-wide admin settings
- Administrator profile and password management
- Floating public Help Center / support widget
- Admin audit log foundation

The live Supabase project also contains RLS-protected tables for these modules. Public catalog/store activation remains disabled in `system_settings.store.enabled` until the client storefront phase is built.


## Smart Commerce v10.9
- Live storefront at `/store` with bilingual product pages, cart and secure order submission.
- Admin Product Studio now stores cost privately, calculates margin/profit, supports direct image/gallery uploads and stock controls.
- Automatic seasonal pricing rules can target the whole store, categories, selected products or tags without overwriting regular prices.
- Product-specific scheduled sales override global seasonal pricing when needed.
- Checkout totals and coupon validation are recalculated server-side in Supabase before an order is created.
- See `SMART-COMMERCE-v10.9.md` for the full implementation summary.

## v10.10.0 — Real System Settings

The settings center was rebuilt as a live configuration layer backed by `public.system_settings` and consumed through `SystemSettingsProvider`.

Functional groups now include:
- Public website behavior: automatic seasonal experience, seasonal action button, WhatsApp/certification floating actions, bottom-navigation labels and first-visit language.
- Public appearance: accent palette, font scale, content width, corner style, glass and motion.
- Admin appearance: accent, font scale, density, default sidebar state, sticky/static topbar, workspace width, glass and motion.
- Store policy: store availability, guest browsing, guest cart, visible pricing, VAT treatment/rate, coupons and minimum order.
- Support: floating help widget, FAQs, signed-in tickets and WhatsApp option.
- Notifications: live in-app channel only. Email and WhatsApp are shown as disconnected integrations instead of fake toggles.
- Security: real admin inactivity auto-lock with configurable timeout.

Store policy is enforced server-side in Supabase for store availability, minimum order, coupon availability and VAT calculations. Guest browsing, support ticket creation and in-app notification visibility are also enforced by RLS policies.

## v10.11.0 — Organization Client Portal

أضيفت بوابة B2B مستقلة على `/portal` لحسابات المنشآت والفنادق والشركات، وتشمل لوحة العميل، الطلبات، السلة، عروض الأسعار، العقود، المستندات المالية، مواقع الخدمة، التواصل، الإشعارات، ملف المنشأة والإعدادات. كما أضيفت للإدارة صفحات عروض الأسعار والعقود والمستندات المالية، مع رفع مستندات خاصة وإرسال يدوي عبر واتساب/البريد بعد إصدار الفاتورة من برنامج المحاسبة الخارجي. لا يصدر الموقع فواتير ضريبية ولا يتصل بـ ZATCA في هذه المرحلة. راجع `CLIENT-PORTAL-v10.11.md`.


---

## آخر تطوير للحساب الفردي — v10.26

تم تنفيذ الصفحة 13 «مركز الطلب الذكي» على المسار الدائم `/account/orders/:id`، مع الانتقال إليه مباشرة بعد نجاح Checkout، وحالة السداد والمسؤول عنه، Realtime للطلب والمستندات، ملخص طلب قابل للطباعة، ومستندات رسمية خاصة وآمنة ترفع من لوحة الإدارة.

ملاحظة تاريخية: متطلبات v10.26 القديمة تم توحيدها وتطبيقها على مشروع Supabase الحي ضمن جولة v10.29. المرجع الحالي هو `SUPABASE-v10.29-LIVE-ALIGNMENT.md`، ولا ينبغي إنشاء Backend مستندات موازٍ.

تفاصيل التنفيذ في:

`INDIVIDUAL-ACCOUNT-PAGE-13.md`


## v10.27.0 — Individual Settings Security & Privacy Center

مركز الأمان والخصوصية أصبح **تابعًا لصفحة الإعدادات** وليس قسمًا مستقلًا في بوابة العميل. المسار الرئيسي هو `/account/settings/security` وتندرج تحته شاشات كلمة المرور، التحقق بخطوتين، الجلسات، Passkeys، والخصوصية والبيانات.

أهم التغييرات:
- نقل أدوات الأمان من الملف الشخصي إلى الإعدادات ومنع التكرار.
- تغيير كلمة المرور مع طلب كلمة المرور الحالية عبر Supabase Auth.
- TOTP / Authenticator App فعلي عبر Supabase MFA، وربطه بتسجيل الدخول عبر AAL2.
- فحص MFA بنمط Fail-Closed: تعذر فحص الحماية لا يتحول إلى دخول عادي.
- إدارة تسجيل الخروج من هذا الجهاز، الأجهزة الأخرى، أو جميع الجلسات.
- Passkeys مجهزة بصريًا لكنها غير مفعلة قبل اعتماد الدومين النهائي/RP ID.
- طلب نسخة من البيانات وطلب حذف الحساب كطلبات موثقة، وليس حذفًا فوريًا من المتصفح.
- سجل نشاط أمان مبسط داخل الحساب بدون اختلاق مواقع أو أجهزة غير موثقة.

متطلبات الأمان والخصوصية أصبحت مطبقة ومطابقة للـSchema الحي ضمن v10.29. راجع `SUPABASE-v10.29-LIVE-ALIGNMENT.md` بدل تشغيل ملف v10.27 القديم.


## v10.28.0 — Individual Documents Vault

The individual customer portal now includes the final planned page at `/account/documents`. It combines order summaries with official accounting PDFs published from the existing individual order-document backend. Official files stay in the private `customer-documents` bucket and are opened through short-lived signed URLs after RLS ownership checks. The page supports in-site PDF preview, secure download, print flow, search by order/invoice/product, filtering, chronological grouping, and Realtime refresh. No new database table is introduced in v10.28; this page consumes the v10.26 order-document backend.


## v10.29 — Final full audit

The final audit was run against both the React source and the connected live Supabase project. The individual customer portal is aligned to the canonical `customer_documents` / `customer-documents` document backend, checkout is restricted to explicit individual accounts at both UI and RPC layers, account/admin/organization security gates fail closed, organization membership is verified before portal entry, RLS/grants were hardened, Realtime is confirmed for order center documents, and the public `SECURITY DEFINER` surface was removed.

See `VALIDATION-v10.29-FINAL.md` and `SUPABASE-v10.29-LIVE-ALIGNMENT.md` for the final audit evidence and live migration summary.


Production build note: the audit environment could not complete package installation, so the final validation does not claim a successful Vite production compile. Run `npm ci && npm run build` in CI/deployment. See `VALIDATION-v10.29-FINAL.md`.

## v10.30 — B2B Organization Home rebuild
The B2B/organization portal rebuild has started. Page 1 (`/portal`) is now the new Organization Pulse experience with the Partnership Garden, Today Pulse, live operation journey, Balqees Care entry surface, organization readiness, real-data milestones, and responsive/mobile behavior.

See:
- `BALQEES-B2B-PORTAL-MASTER-PLAN-v1.0.md`
- `VALIDATION-v10.30-B2B-HOME.md`
