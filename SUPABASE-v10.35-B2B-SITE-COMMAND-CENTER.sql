-- Balqees Floral v10.35 — B2B Site Command Center (final-state reference)
-- Live project already contains these migrations. This file documents the final schema/policy intent.

alter table public.organization_sites
  add column if not exists access_details jsonb not null default '{}'::jsonb,
  add column if not exists service_preferences jsonb not null default '{}'::jsonb,
  add column if not exists last_verified_at timestamptz,
  add column if not exists last_verified_by uuid references auth.users(id) on delete set null,
  add column if not exists archived_at timestamptz;

create table if not exists public.organization_site_areas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null references public.organization_sites(id) on delete cascade,
  name_ar text not null,
  name_en text,
  area_type text not null default 'custom',
  notes_ar text,
  notes_en text,
  preferences jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_site_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null references public.organization_sites(id) on delete cascade,
  contact_type text not null default 'receiving',
  name text not null,
  role_ar text,
  role_en text,
  phone text,
  email text,
  is_primary boolean not null default false,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_site_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null references public.organization_sites(id) on delete cascade,
  file_kind text not null default 'document',
  category text not null default 'general',
  title_ar text,
  title_en text,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  is_cover boolean not null default false,
  is_visible boolean not null default true,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_site_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null references public.organization_sites(id) on delete cascade,
  event_type text not null,
  title_ar text not null,
  title_en text,
  body_ar text,
  body_en text,
  actor_type text not null default 'system',
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.organization_site_areas enable row level security;
alter table public.organization_site_contacts enable row level security;
alter table public.organization_site_files enable row level security;
alter table public.organization_site_events enable row level security;

-- Final production policies use private.site_child_visible(...) and private.org_permission(...,'manage_sites').
-- Hidden contact/file rows are excluded from normal member SELECT policies.
-- Storage bucket: organization-site-files (private, 20 MiB, JPEG/PNG/WebP/PDF).
-- Final Storage SELECT policy requires either Balqees admin access or matching visible file metadata + active org membership.
-- Realtime: organization_sites + organization_site_events.
