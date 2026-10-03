# Balqees Floral v10.40 — Pages 9 & 10 Final Validation

هذه الجولة تقفل الصفحة التاسعة **الفريق والصلاحيات** والصفحة العاشرة **مركز عناية بلقيس الذكي** مقابل البنود المعتمدة في `Balqees-B2B-Portal-Master-Plan-v1.0.md`.

## حالة التحقق

- ✅ فحص صياغة JSX/JS للصفحات والمسارات المعدلة عبر TypeScript parser: ناجح.
- ✅ Edge Function لا يظهر أخطاء syntax؛ الأخطاء المتبقية في فحص TypeScript المحلي هي فقط عدم توفر Deno globals و`npm:` module resolver خارج بيئة Supabase Edge Runtime.
- ⚠️ `npm run build` الكامل غير معتمد في هذه الحزمة: تثبيت الاعتمادات تعطل بسبب مهلة بيئة التنفيذ، ثم أعاد Build الخطأ الفعلي `vite: not found` لأن `node_modules` بقي جزئيًا.
- ⚠️ Migration `SUPABASE-v10.40-B2B-TEAM-CARE-FINAL.sql` مضمن ولم يتم الادعاء بأنه طُبق تلقائيًا على قاعدة الإنتاج.
- ⚠️ مزود LLM الخارجي اختياري ويحتاج Secrets على Edge Function. بدون المزود، مركز العناية يظل يعمل عبر الأدوات المسموحة والمنطق الموثوق + التحويل البشري.

---

# الصفحة 9 — الفريق والصلاحيات

## متطلبات الخطة

- ✅ الأدوار الجاهزة: Owner / Organization Manager / Procurement Manager / Approver / Finance / Site Manager / Receiving Officer / Viewer.
- ✅ أدوار مخصصة `organization_custom_roles`.
- ✅ بطاقات الأعضاء: الاسم، البريد، الدور، الحالة، المواقع، آخر دخول، MFA، حد الاعتماد والصلاحيات.
- ✅ Invite Wizard حقيقي برابط دعوة مميز ومربوط بالبريد.
- ✅ Site-scoped permissions.
- ✅ Permission Matrix View/Create/Edit/Approve.
- ✅ Permission Overrides ثلاثية الحالة: يرث / يسمح / يمنع.
- ✅ Approval limit لكل عضو.
- ✅ حد الاعتماد مطبق فعليًا على قرار اعتماد عرض السعر في قاعدة البيانات، وليس مجرد رقم في الواجهة.
- ✅ Approval Hierarchy مهيأ للبناء لاحقًا كما نصت الخطة (لم يتم اختراع Workflow متعدد المستويات قبل اعتماده).
- ✅ المسؤوليات: المشتريات، المالية، العقود، الاعتماد، ومسؤول لكل موقع.
- ✅ Team Care: MFA ناقص، خمول، اقتراب انتهاء الوصول المؤقت، موقع نشط بلا مسؤول.
- ✅ حالات العضو: Active / Pending invitation / Suspended / Expired / Removed.
- ✅ Temporary access expiry.
- ✅ سياسات MFA حسب Managers / Approvers / Finance، إضافة إلى MFA خاص بعضو.
- ✅ AAL2 يفرض قبل العمليات الحساسة عند الحاجة.
- ✅ Audit لتغييرات العضوية والصلاحيات وحد الاعتماد والحالة ونقل الملكية والتدخل الإداري.
- ✅ حماية آخر Owner.
- ✅ نقل الملكية Workflow مستقل ومحمي بـ MFA/AAL2.
- ✅ Multi-organization membership + Organization switcher.
- ✅ Admin counterpart لمراجعة فرق المنشآت.
- ✅ تدخل بلقيس محدود إلى suspend/reactivate مع سبب إلزامي وAudit؛ لا Impersonation.
- ✅ RLS + permission-aware RPCs؛ إخفاء UI ليس طبقة الأمان الوحيدة.
- ✅ تقاعد RPCs القديمة الواسعة من v10.38 واستبدالها بوظائف v10.40 المقيدة.
- ✅ Approval guard على quotations يمنع اعتماد عرض خارج الصلاحية/النطاق/حد الاعتماد/MFA.

## ملفات رئيسية

- `src/client/pages/ClientTeamPermissions.jsx`
- `src/client/OrganizationInviteAccept.jsx`
- `src/client/ClientPortalContext.jsx`
- `src/client/ClientPortalLayout.jsx`
- `src/client/pages/ClientQuotes.jsx`
- `src/admin/pages/AdminOrganizationTeam.jsx`
- `src/client/team-permissions.css`
- `SUPABASE-v10.40-B2B-TEAM-CARE-FINAL.sql`

---

# الصفحة 10 — مركز العناية الذكي

## متطلبات الخطة

- ✅ هوية **عناية بلقيس** بدون Robot Avatar؛ أيقونة زهرية/مجردة في واجهة العميل.
- ✅ سياق Organization + Site + Order + Quotation + Contract + Financial Document.
- ✅ تثبيت Exact Entity عند فتح العناية من العنصر نفسه.
- ✅ إصلاح روابط السياق من الطلب والموقع والعقد والمستند والعرض.
- ✅ دعم مستند مالي exact عبر `source_kind + source_id` بدل الاكتفاء بآخر مستند.
- ✅ أين وصل طلبي؟
- ✅ تفاصيل الطلب.
- ✅ لماذا تغير عرض السعر؟ مقارنة Version-to-Version.
- ✅ ملخص العرض الحالي.
- ✅ ملخص العقد والتغطية المهيكلة.
- ✅ منع التفسير القانوني إذا التغطية غير Structured + Human handoff.
- ✅ معلومات الموقع ضمن Site Scope.
- ✅ بحث الكتالوج المؤسسي.
- ✅ مستندات مالية ضمن صلاحية Finance فقط.
- ✅ Repeat Order لا ينشئ طلبًا ملزمًا؛ ينشئ Draft للمراجعة.
- ✅ Create Request Draft لا يرسل الطلب تلقائيًا.
- ✅ Human Case + Add Support Message عبر RPCs محددة.
- ✅ Named safe tools فقط؛ لا Generic SQL Tool.
- ✅ كل أداة تتحقق من Organization membership + permission + site scope عند الحاجة.
- ✅ Tool Audit: user / organization / tool / entity / safe parameters / result summary / timestamp.
- ✅ قاعدة المعرفة: FAQ / Policy / Service / Hours / Instruction / Change Policy / Organization-specific.
- ✅ Draft / Published / Archived للمعرفة.
- ✅ لا Auto-learning من ردود الموظف.
- ✅ “اقتراح معرفة جديدة” ينتج Draft للمراجعة بدل نشر تلقائي.
- ✅ Human Handoff ينقل context + summary + conversation.
- ✅ Human Takeover يضيف رسالة فعلية باسم موظف بلقيس داخل المحادثة.
- ✅ Agent Assist للموظف: summary + reply guidance + knowledge references.
- ✅ الرد المقترح يصبح Draft فقط؛ الموظف يراجع ويرسل بنفسه.
- ✅ AI Kill Switch حقيقي من لوحة الإدارة.
- ✅ Tool-level switches حقيقية للطلبات/العروض/العقود/المواقع/الكتالوج/المالية/المسودات/المعرفة/Agent Assist.
- ✅ عند إيقاف AI تبقى الأدوات الآمنة وHuman Care دون انهيار الصفحة.
- ✅ External AI Edge Function Provider-neutral وبلا Service Role.
- ✅ LLM لا يختار اسم RPC حر؛ Intent -> Allow-list ثابتة.
- ✅ Data minimization قبل إرسال نتيجة الأداة إلى مزود AI الخارجي.
- ✅ لا Chain of Thought في Audit أو الواجهة.
- ✅ الإجابة تقول إن المعلومة غير مؤكدة عند غياب البيانات بدل التخمين.
- ✅ لا اعتماد عرض / إلغاء عقد / Refund / تغيير مبلغ / حذف بيانات بواسطة AI.
- ✅ تقاعد endpoint القديم `open_organization_care_case` من v10.39 لصالح v10.40 private implementation + invoker wrapper.
- ✅ Knowledge table direct read صار Admin-only؛ العملاء يصلون للمعرفة فقط من RPC المصرح.
- ✅ Knowledge RPC يتحقق من صلاحية المنشأة لمنع الوصول إلى محتوى منشأة أخرى بالـUUID.
- ✅ Care Tool Audit direct table read صار Admin-only.

## أدوات العناية المنفذة

- `care_get_active_orders_v2`
- `care_get_order_details_v2`
- `care_get_quotation_v2`
- `care_compare_quotation_versions_v2`
- `care_get_contract_summary_v2`
- `care_get_site_details_v2`
- `care_search_catalog_v2`
- `care_get_financial_documents_v2`
- `care_prepare_repeat_order_v2`
- `care_create_request_draft_v2`
- `care_search_knowledge_v2`
- `open_organization_care_case_v2`
- `add_organization_care_message_v2`
- `admin_claim_care_case_v2`
- `admin_get_care_assist_v2`

## ملفات رئيسية

- `src/client/pages/ClientSupport.jsx`
- `src/admin/pages/AdminSupport.jsx`
- `src/client/pages/ClientRequestWizard.jsx`
- `src/client/pages/ClientOrders.jsx`
- `src/client/pages/ClientSites.jsx`
- `src/client/pages/ClientContracts.jsx`
- `src/client/pages/ClientFinancialDocs.jsx`
- `src/client/pages/smart-care.css`
- `supabase/functions/balqees-care/index.ts`
- `SMART-CARE-AI-PROVIDER-SETUP-v10.40.md`
- `SUPABASE-v10.40-B2B-TEAM-CARE-FINAL.sql`

---

# ما يحتاج إعدادًا خارجيًا عند الإطلاق

## 1. تطبيق قاعدة البيانات
طبّق migrations بالترتيب:
1. `SUPABASE-v10.38-B2B-TEAM-PERMISSIONS-PAGE-9.sql`
2. `SUPABASE-v10.39-B2B-SMART-CARE-PAGE-10.sql`
3. `SUPABASE-v10.40-B2B-TEAM-CARE-FINAL.sql`

## 2. AI Provider — اختياري
إذا أردت طبقة اللغة الاصطناعية الخارجية، انشر Edge Function `balqees-care` واضبط Secrets الموضحة في:
`SMART-CARE-AI-PROVIDER-SETUP-v10.40.md`.

لا تضع Service Role داخل واجهة React أو داخل أدوات AI.

## 3. دعوات الأعضاء
إنشاء/قبول الدعوات يعمل من النظام. الإرسال الآلي بالبريد يحتاج مزود Transactional Email/SMTP؛ إلى أن يربط، رابط الدعوة قابل للنسخ والمشاركة يدويًا.

---

# قرار الإقفال

على مستوى **الكود والخطة المعتمدة**: الصفحتان 9 و10 مغلقتان في v10.40 مع Backend/RLS/RPC/Admin counterparts وسياق وأمان حقيقيين.

على مستوى **الإطلاق الحي**: يلزم تطبيق migration، نشر Edge Function إذا أريد LLM خارجي، ثم تشغيل Build/QA في بيئة تتوفر فيها الاعتمادات كاملة قبل Production deployment.

---

# جولة الإقفال الإضافية — Site Scope + Care Privacy

بعد مقارنة الصفحة 9 مع السياسات الحية الحالية لصفحات B2B السابقة، تم اكتشاف أن بعض السياسات القديمة كانت تتحقق من عضوية المنشأة فقط ولا تطبق نطاق المواقع الجديد. تم إغلاق هذا الفرق داخل Migration v10.40 حتى تكون صفحة الفريق والصلاحيات محرك وصول حقيقي للبوابة كلها، لا مجرد شاشة إدارة أعضاء.

## تكامل Site Scope عبر الصفحات السابقة

- ✅ الطلبات: عضو المنشأة المقيد بمواقع يرى طلبات المواقع المسموحة فقط، مع الحفاظ على وصول العميل الفردي لطلباته الشخصية وإدارة بلقيس.
- ✅ عناصر الطلب وأحداثه ترث نفس نطاق الطلب.
- ✅ طلبات الخدمات والمرفقات ترث نطاق الموقع وصلاحية Create Orders.
- ✅ عروض الأسعار وعناصرها وأحداثها تحترم الموقع الفعلي للعرض أو الطلب/الطلب الخدمي المرتبط.
- ✅ `mark_quotation_viewed` و`respond_to_quotation` لم تعد تتجاوز Site Scope بسبب SECURITY DEFINER.
- ✅ قرار العرض يطبق Permission + Site Scope + Approval Limit + MFA/AAL2 على السيرفر.
- ✅ المواقع: القراءة والإدارة حسب نطاق الموقع؛ العضو المقيد لا يستطيع إنشاء موقع جديد أو تغيير الافتراضي من الواجهة.
- ✅ مناطق الموقع وجهات الاتصال والملفات والأحداث ترث نطاق الموقع.
- ✅ العقود: العضو المقيد يرى العقد فقط إذا كان يغطي موقعًا من نطاقه.
- ✅ صفوف `contract_sites` نفسها تعرض فقط المواقع المسموحة.
- ✅ التزامات العقد المرتبطة بموقع تحترم نطاق الموقع.
- ✅ البيانات المالية للعقد تتطلب Finance permission + عقدًا مرئيًا للمستخدم.
- ✅ المستندات المالية تطبق visibility + membership + source/site scope.
- ✅ `get_organization_document_center` تمت إعادة حماية implementation الداخلي حتى لا يتجاوز RLS بسبب SECURITY DEFINER.
- ✅ Signed URLs في `client-documents` تحترم نفس نطاق المستند/العرض/العقد.
- ✅ ملفات المواقع في Storage تحترم Site Scope للقراءة والرفع والتعديل والحذف.
- ✅ مرفقات طلبات الخدمات في Storage تحترم نطاق الطلب وموقعه.

## خصوصية مركز العناية

- ✅ عميل B2B لا يرى محادثات بقية أعضاء المنشأة؛ يرى محادثاته فقط.
- ✅ استمرار الوصول للمحادثة يتطلب عضوية فعالة وصلاحية `create_support_cases` وسياقًا مسموحًا.
- ✅ سياق Order / Quotation / Contract / Site / Document يتم التحقق منه Server-side قبل فتح Human Case.
- ✅ `source_kind` للمستند ينتقل في handoff حتى يتم التحقق من المستند الدقيق.
- ✅ رسائل المحادثة ترث نفس سياسة المحادثة، بينما Admin Care Inbox يحتفظ بالوصول الإداري الكامل.

## فحص حي Read-only

تم استخدام مشروع Supabase الحي `balqees-floral` للقراءة فقط لمراجعة أسماء الجداول والسياسات والدوال الحالية قبل كتابة التوافق، بدون تطبيق Migration v10.40 أو تعديل بيانات الإنتاج.

## نتيجة Build النهائية في بيئة العمل

- ✅ فحص Parse للملفات JSX المعدلة مر بدون أخطاء صياغة.
- ✅ توازن Dollar-quoted blocks في SQL تم فحصه (`$$` متوازن).
- ⚠️ `npm run build` لم يكتمل لأن تثبيت الاعتمادات تعطل بمهلة البيئة، والـ`vite` executable غير موجود في `node_modules` الجزئي. الخطأ الفعلي: `vite: not found`.
- ⚠️ لذلك لا يُكتب في هذه النسخة أن Production Build ناجح؛ المطلوب بعد فك الحزمة: `npm ci` ثم `npm run build` في بيئة شبكة مستقرة.
