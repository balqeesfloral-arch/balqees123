-- Balqees Floral v10.43 — B2B portal QA & storage hardening
-- Apply AFTER SUPABASE-v10.42-B2B-PORTAL-SETTINGS-PAGE-12.sql.
-- Idempotent storage-state hardening discovered during the Pages 1–12 QA pass.

begin;

-- Page 6 depends on this private bucket. Earlier Page 6 SQL documented the bucket
-- but did not create it, so a fresh environment could fail when uploading site files.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'organization-site-files',
  'organization-site-files',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Page 12 UI intentionally rejects SVG logos. Keep Storage aligned with the UI and
-- reduce active-content/image-parser attack surface to the formats we actually use.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'organization-assets',
  'organization-assets',
  false,
  5242880,
  array['image/png','image/jpeg','image/webp']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

commit;
