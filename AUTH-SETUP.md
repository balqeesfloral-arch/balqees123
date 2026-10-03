# Balqees Floral — تفعيل تسجيل الدخول وإنشاء الحساب

الواجهة في `src/pages/Account.jsx` جاهزة للعمل مع **Supabase Auth** وتدعم:

- تسجيل الدخول بالبريد وكلمة المرور.
- إنشاء حساب فردي أو حساب شركة/فندق.
- حفظ الاسم والجوال واسم المنشأة ونوع الحساب داخل `user_metadata`.
- تأكيد البريد الإلكتروني إذا كان Email Confirmation مفعّلًا.
- استعادة كلمة المرور وتعيين كلمة جديدة.
- استمرار الجلسة وتحديثها تلقائيًا.
- تسجيل الخروج.

## 1) متغيرات البيئة

أضف في Vercel > Project Settings > Environment Variables:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

استخدم فقط المفتاح العام `anon` / `publishable`. **لا تستخدم service_role داخل React.**

للتطوير المحلي انسخ `.env.example` إلى `.env.local` وضع القيم الحقيقية.

## 2) إعداد Supabase Auth

من Supabase Dashboard:

1. افتح Authentication > Providers > Email.
2. فعّل Email provider.
3. يفضّل إبقاء Confirm email مفعّلًا في النسخة العامة.
4. افتح Authentication > URL Configuration.
5. اجعل Site URL هو رابط موقع بلقيس النهائي.
6. أضف Redirect URLs التالية مع استبدال الدومين:
   - `https://YOUR-DOMAIN/account`
   - `https://YOUR-DOMAIN/**`
   - للتطوير: `http://localhost:5173/account`

## 3) Vercel

بعد إضافة المتغيرات أعد Deploy للمشروع. متغيرات Vite تدخل أثناء الـ build، لذلك يلزم نشر جديد بعد إضافتها.

## 4) اختبار سريع

1. افتح `/account`.
2. اختر «إنشاء حساب».
3. أنشئ حسابًا ببريد تستطيع فتحه.
4. افتح رسالة التفعيل (إذا كان التأكيد مفعّلًا).
5. سجّل الدخول.
6. جرّب «نسيت كلمة المرور» ثم افتح رابط الاستعادة واختر كلمة مرور جديدة.

## المواسم

أزرار تجربة المواسم حُذفت من نسخة الإطلاق. الواجهة تختار الموسم تلقائيًا عبر `src/lib/season.js` بتوقيت مكة المكرمة وتقويم أم القرى، وتعيد التحقق تلقائيًا أثناء بقاء الصفحة مفتوحة.


## Guided registration v10.5

A dedicated `/signup` page now supports organization and individual accounts.

For persistent customer profiles, run `SUPABASE-CUSTOMER-PROFILES.sql` once in Supabase SQL Editor. This creates `customer_profiles`, RLS policies, and a trigger that copies signup metadata from `auth.users`.

Validation currently enforced in the browser:
- Saudi mobile number: 05xxxxxxxx / +9665xxxxxxxx.
- Unified commercial number: 10 digits beginning with 7.
- VAT registration number: 15 digits beginning and ending with 3.
- National Address: 4-digit building number, 4-digit secondary number, 5-digit postal code; short address is optional (4 letters + 4 digits).

Important: format validation is not the same as verifying that a commercial/VAT record exists. The UI links to the official Ministry of Commerce and ZATCA verification services. Do not scrape those public pages; use an approved government/API integration later if automated registry verification is required.
