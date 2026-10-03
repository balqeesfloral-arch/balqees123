# Balqees Floral v10.41 — Page 11: Notification Action Center

تم تحويل صفحة الإشعارات في بوابة المنشآت من Inbox بسيط إلى **Action Center** حقيقي مطابق لخطة `Balqees-B2B-Portal-Master-Plan-v1.0.md`.

## ما تغيّر للعميل

- قسم **يحتاج منك إجراء** لا يختفي بمجرد القراءة.
- فصل واضح بين `read_at` وبين اكتمال الـBusiness Action.
- Badge البوابة يعتمد على الإجراءات القابلة للتنفيذ للمستخدم، وليس عدد كل الإشعارات.
- قسم **بينما كنت بعيدًا** يلخص ما تغيّر منذ آخر زيارة.
- تجميع تحديثات نفس الكيان في Thread واحد لتقليل الضوضاء.
- Snooze: بعد ساعة / مساء اليوم / غدًا، بدون تعديل حالة الطلب أو العرض.
- Follow Entity: متابعة طلب/عرض/عقد تعني استقبال Event-level updates إضافية لهذا المستخدم فقط.
- فلاتر: الكل / الطلبات / المالية / العقود / العناية / الأمان / المؤجل.
- AI Summary عبر Edge Function الحالية، مع Safe Local Summary كـFallback.
- Realtime refresh للإشعارات وحالة القراءة.
- Device Registry مستقل لكل مستخدم + منشأة + جهاز.
- PWA Service Worker + Manifest + Deep Link عند الضغط على Push.
- لا يتم طلب Notification Permission تلقائيًا؛ تفعيل Push يظل قرارًا صريحًا من صفحة الإعدادات.

## ما تغيّر للإدارة

- صفحة **Notification Operations Center** بدل Composer بسيط.
- مراقبة:
  - Event type.
  - Audience.
  - Recipient count.
  - Delivered / Pending / Failed.
  - Read receipts.
  - Action state.
  - Scheduled time.
- Manual Announcement Composer يدعم:
  - منشأة محددة.
  - مستخدمًا محددًا داخل منشأة.
  - كل المنشآت.
  - Priority.
  - Deep Link داخلي.
  - Action Required.
  - Entity linkage.
  - Channel plan.
  - Schedule / Publish now / Draft.
- القنوات الخارجية لا تُعتبر مرسلة بدون Adapter حقيقي؛ تبقى `pending` في Delivery Ledger.

## Notification Core

- `notification_events`
- `notification_deliveries`
- `notification_preferences`
- `notification_category_preferences`
- `user_devices`
- `notification_entity_follows`
- امتدادات على `notifications` و`notification_reads` لحالة الإجراء والتأجيل والكيان والدِدوب والقنوات.

## Scheduled business reminders

- عرض السعر: قبل انتهاء الصلاحية بيومين.
- العقد: قبل النهاية بـ60 يومًا.
- الطلب: قبل موعد التنفيذ بـ24 ساعة.
- إذا انتهت الحاجة قبل الموعد، يتحول Reminder إلى `archived` وتُلغى Deliveries المعلقة.

## Quiet Hours

- In-App يبقى مسجلًا.
- القنوات الخارجية غير الحرجة تتأجل حتى نهاية الساعات الهادئة.
- القناة نفسها تخضع لتفضيل المستخدم حسب التصنيف.

## App-ready

- Deep Links ثابتة.
- Device registry.
- Web Push worker.
- Delivery ledger مستقل عن المزود.
- البنية قابلة لإضافة FCM/APNs/Expo لاحقًا بدون إعادة بناء منطق المستلمين والأولوية.
