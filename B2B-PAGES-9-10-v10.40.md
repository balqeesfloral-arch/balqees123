# Balqees Floral v10.40 — B2B Pages 9 & 10

## Page 9 — Team & Permissions
تحولت إلى Identity & Access Center فعلي: أدوار جاهزة ومخصصة، Permission Matrix، Site Scope، MFA Policies، Approval Limits مطبقة على اعتماد عروض الأسعار، وصول مؤقت، مسؤوليات، Team Care، Multi-Organization، Audit، Ownership Transfer، Admin Intervention بدون Impersonation.

## Page 10 — Balqees Smart Care
تحولت إلى AI Customer Care + Human Care: Exact Entity Context، Safe Named Tools، Knowledge Base مراجعة، Human Takeover، Agent Assist، Request Draft/Repeat Draft، Tool Audit، Kill Switch، Tool Controls، وحماية من الهلوسة والإجراءات الملزمة. Edge Function اختيارية لمزود LLM وتستخدم JWT المستخدم فقط، ولا تستخدم Service Role أو Generic SQL.

## قاعدة مهمة
أي مزود AI خارجي يحصل على **بيانات مصغرة فقط** بعد نجاح أداة مصرح بها؛ البيانات والصلاحيات والقرار تبقى داخل Supabase/بلقيس.

## Final hardening addendum

- Page 9 Site Scope now governs legacy B2B resources too: orders, requests, quotations, sites, contracts, finance/document center and relevant Storage policies.
- SECURITY DEFINER operations that previously relied only on organization membership were wrapped/redefined with explicit permission + site checks.
- Page 10 organization-care conversations are private to the participating member on the customer side; Balqees admins retain the complete operational inbox.
- Exact document handoff now preserves `source_kind` alongside the entity ID.
- No v10.40 migration was applied automatically to production during this build round.
