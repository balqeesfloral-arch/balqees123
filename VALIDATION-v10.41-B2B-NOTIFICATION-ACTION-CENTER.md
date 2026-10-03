# Balqees Floral v10.41 — Page 11 Validation

هذه الجولة تخص **الصفحة 11 — مركز الإشعارات** في بوابة المنشآت.

## التحقق التقني

- ✅ فحص Syntax للملفات المعدلة عبر TypeScript parser:
  - `src/client/pages/ClientNotifications.jsx`
  - `src/admin/pages/AdminNotifications.jsx`
  - `src/client/ClientPortalLayout.jsx`
  - `src/main.jsx`
  - `supabase/functions/balqees-care/index.ts`
- ✅ لا توجد Parse Diagnostics في الملفات أعلاه.
- ✅ تمت مراجعة Live Schema في مشروع `balqees-floral` قراءة فقط للتأكد من:
  - أعمدة `notifications` و`notification_reads` الحالية.
  - CHECK constraints الحالية للجمهور والحالة والنوع.
  - بنية `order_events` / `quotation_events` / `contract_events`.
  - بنية `audit_logs`.
- ✅ Migration لا يستخدم حالة Notification غير مسموحة؛ الإلغاء التجاري للتذكير يتحول إلى `archived`، بينما Delivery يمكن أن يكون `cancelled`.
- ✅ Static checks على Migration: Dollar-quoting متوازن، ولا توجد مراجع إلى جدول Audit غير موجود.
- ⚠️ `npm run build` الكامل غير معتمد: `npm ci` تجاوز مهلة بيئة التنفيذ وترك `node_modules` غير مكتمل، وبالتالي `vite` غير متاح.
- ⚠️ Migration v10.41 مضمن في الحزمة ولم يُطبق تلقائيًا على قاعدة الإنتاج.

---

# مطابقة ملف الخطة

## Action Center
- ✅ الصفحة ليست Inbox فقط.
- ✅ `Action Required` مستقل عن Read.
- ✅ Empty state: «كل شيء مرتب — لا توجد إجراءات مطلوبة منك حاليًا».
- ✅ Permission-aware action cards.

## الآن / Feed
- ✅ Live feed.
- ✅ فلاتر تشغيلية.
- ✅ Realtime refresh.

## بينما كنت بعيدًا
- ✅ يعتمد على `last_center_seen_at`.
- ✅ يعرض عدد التحديثات + Orders / Finance / Contracts / Decisions.

## التجميع
- ✅ `group_key` + Entity grouping.
- ✅ عدة تحديثات لنفس الكيان تظهر كThread واحد.

## Snooze
- ✅ بعد ساعة.
- ✅ مساء اليوم.
- ✅ غدًا.
- ✅ لا يغير Business State.

## Follow Entity
- ✅ تخزين Follow per user/org/entity.
- ✅ Events التفصيلية للطلب/العرض/العقد تُرسل فقط للمستخدم الذي اختار المتابعة.

## Badge
- ✅ يعتمد على `action_count` القابل للتنفيذ للمستخدم.
- ✅ لا يعتمد على كل Unread.

## Privacy / Quiet Hours
- ✅ Schema للـLock Screen preview.
- ✅ Quiet hours موجودة في Core Preferences.
- ✅ Delivery Engine يؤجل external channels غير الحرجة أثناء Quiet Hours.
- ✅ In-App يبقى مسجلًا.

## Device registration
- ✅ `user_devices` لكل جهاز.
- ✅ تسجيل المتصفح بدون طلب Push permission.
- ✅ PWA service worker منفصل عن provider.

## Deep Links
- ✅ الطلب / العرض / العقد / المستند / العناية عبر `action_url`.
- ✅ Service Worker يفتح الـDeep Link عند Notification click.

## AI Summary
- ✅ `لخص لي المهم`.
- ✅ External AI يستخدم Authorized notification projection فقط.
- ✅ Local deterministic fallback إذا AI غير متاح أو Disabled.
- ✅ لا Chain of Thought في الواجهة.

## Admin Notification Operations
- ✅ Event.
- ✅ Audience.
- ✅ Recipient count.
- ✅ Channel delivery state.
- ✅ Read state.
- ✅ Action state.
- ✅ Filters للفشل والمجدول والإجراءات واليدوي.

## Manual announcements
- ✅ Organization.
- ✅ Specific member داخل Organization.
- ✅ Company-wide broadcast.
- ✅ Internal Deep Link validation.
- ✅ Channels.
- ✅ Priority.
- ✅ Scheduling.
- ✅ Audit entry.

## Scheduled notifications
- ✅ 24h قبل موعد تنفيذ الطلب.
- ✅ 60 يومًا قبل نهاية العقد.
- ✅ يومان قبل انتهاء عرض السعر.
- ✅ تُؤرشف تلقائيًا إذا انتهت الحاجة قبل موعدها.
- ✅ Backfill للسجلات الحالية عند تطبيق Migration.

## Event-first / App-ready
- ✅ `notification_events` ledger.
- ✅ compatibility mirror للإدخالات القديمة.
- ✅ `notification_deliveries` provider-agnostic.
- ✅ Push/Email لا يقرران Business Logic.
- ✅ Native adapters يمكن إضافتها لاحقًا دون تغيير Action Center.

---

# الملفات الرئيسية

- `src/client/pages/ClientNotifications.jsx`
- `src/client/notification-action-center.css`
- `src/admin/pages/AdminNotifications.jsx`
- `src/admin/notification-operations.css`
- `src/client/ClientPortalLayout.jsx`
- `supabase/functions/balqees-care/index.ts`
- `public/balqees-sw.js`
- `public/manifest.webmanifest`
- `SUPABASE-v10.41-B2B-NOTIFICATION-ACTION-CENTER.sql`

# ما يحتاج إعدادًا خارجيًا لاحقًا

- Web Push VAPID / Push provider adapter.
- Email provider adapter.
- WhatsApp official provider adapter إن تقرر استخدامه.
- iOS/APNs أو Android/FCM adapter عند بناء التطبيق.

عدم وجود هذه المزودات **لا يكسر مركز الإشعارات**؛ In-App يعمل، والقنوات غير الموصولة تبقى Pending بوضوح.
