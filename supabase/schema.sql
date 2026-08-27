-- ============================================================
-- Latin America Kosher — Certification Portal
-- Database Schema for Supabase (PostgreSQL)
-- ============================================================
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ── EXTENSIONS ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- One row per authenticated user (both clients and staff).
-- Links to Supabase's built-in auth.users table.
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'staff', 'admin')),
  company_name text,
  contact_name text,
  phone text,
  address text,
  preferred_language text not null default 'es' check (preferred_language in ('es', 'en', 'pt')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is 'One row per user. role=client sees only their own certifications. role=staff/admin can manage everything.';

-- ============================================================
-- CERTIFICATIONS
-- Each row = one certified product for one client.
-- ============================================================
create table if not exists certifications (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references profiles(id) on delete cascade,
  product_name text not null,
  product_category text,
  certification_number text unique not null,
  date_issued date,
  expiration_date date not null,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  mashguiach_notes text,
  monday_item_id text unique, -- links to the Monday.com board item, if synced
  approved_by uuid references profiles(id),
  approval_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table certifications is 'Product-level kosher certifications. Status (active/expiring/expired) is computed from expiration_date + approval_status, not stored.';

create index if not exists idx_certifications_client on certifications(client_id);
create index if not exists idx_certifications_expiration on certifications(expiration_date);
create index if not exists idx_certifications_approval on certifications(approval_status);
create index if not exists idx_certifications_monday on certifications(monday_item_id);

-- ============================================================
-- AUDIT LOG
-- Records every meaningful action for compliance/traceability.
-- ============================================================
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  action text not null, -- e.g. 'certification.created', 'certification.approved', 'certificate.printed'
  entity_type text not null, -- 'certification' | 'client' | 'profile'
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created on audit_logs(created_at desc);

-- ============================================================
-- REMINDER LOG
-- Tracks which expiration-reminder emails have already gone out, so
-- the scheduled reminder job never emails a client twice for the same
-- certification + urgency threshold (e.g. "30 days left" only sends
-- once, even if the job runs daily).
-- ============================================================
create table if not exists reminder_log (
  id uuid primary key default uuid_generate_v4(),
  certification_id uuid not null references certifications(id) on delete cascade,
  threshold_days integer not null,
  sent_at timestamptz not null default now(),
  unique (certification_id, threshold_days)
);

create index if not exists idx_reminder_log_certification on reminder_log(certification_id);

-- ============================================================
-- HELPER FUNCTION: current user's role
-- Used inside RLS policies below.
-- ============================================================
create or replace function get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from profiles where id = auth.uid();
$$;

-- ============================================================
-- HELPER FUNCTION: is staff or admin
-- ============================================================
create or replace function is_staff()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select role in ('staff', 'admin') from profiles where id = auth.uid()), false);
$$;

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- When a new user signs up via Supabase Auth, automatically
-- create their profile row (default role = client).
-- Staff/admin roles are promoted manually by an existing admin.
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, role, company_name, contact_name, preferred_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'contact_name',
    coalesce(new.raw_user_meta_data->>'preferred_language', 'es')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- updated_at AUTO-TOUCH
-- ============================================================
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles on profiles;
create trigger touch_profiles before update on profiles
  for each row execute procedure touch_updated_at();

drop trigger if exists touch_certifications on certifications;
create trigger touch_certifications before update on certifications
  for each row execute procedure touch_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table certifications enable row level security;
alter table audit_logs enable row level security;
alter table reminder_log enable row level security;

-- PROFILES policies
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id or is_staff());

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id or is_staff());

drop policy if exists "Staff can insert profiles" on profiles;
create policy "Staff can insert profiles"
  on profiles for insert
  with check (is_staff() or auth.uid() = id);

-- CERTIFICATIONS policies
drop policy if exists "Clients view own certifications" on certifications;
create policy "Clients view own certifications"
  on certifications for select
  using (client_id = auth.uid() or is_staff());

drop policy if exists "Staff manage certifications" on certifications;
create policy "Staff manage certifications"
  on certifications for insert
  with check (is_staff());

drop policy if exists "Staff update certifications" on certifications;
create policy "Staff update certifications"
  on certifications for update
  using (is_staff());

drop policy if exists "Staff delete certifications" on certifications;
create policy "Staff delete certifications"
  on certifications for delete
  using (is_staff());

-- AUDIT LOG policies
drop policy if exists "Staff view audit logs" on audit_logs;
create policy "Staff view audit logs"
  on audit_logs for select
  using (is_staff());

drop policy if exists "Anyone authenticated can write audit logs" on audit_logs;
create policy "Anyone authenticated can write audit logs"
  on audit_logs for insert
  with check (auth.uid() is not null);

-- REMINDER LOG policies
-- Reminder emails are sent by server-side jobs using the service role
-- key, which bypasses RLS entirely — these policies exist so staff can
-- view the log from an authenticated session (e.g. for debugging) and
-- as a safety net for any future authenticated insert path.
drop policy if exists "Staff view reminder log" on reminder_log;
create policy "Staff view reminder log"
  on reminder_log for select
  using (is_staff());

drop policy if exists "Staff insert reminder log" on reminder_log;
create policy "Staff insert reminder log"
  on reminder_log for insert
  with check (is_staff());

-- ============================================================
-- VIEW: certifications with computed status
-- Makes querying "active / expiring_soon / expired" simple
-- from the app without duplicating logic in JS.
-- ============================================================
create or replace view certifications_with_status as
select
  c.*,
  case
    when c.approval_status != 'approved' then c.approval_status
    when c.expiration_date < current_date then 'expired'
    when c.expiration_date < current_date + interval '30 days' then 'expiring_soon'
    else 'active'
  end as status
from certifications c;

-- ============================================================
-- Done! Next steps:
-- 1. Go to Authentication > Providers and make sure Email is enabled
-- 2. Create your first admin user (see README.md "Creating your first admin")
-- 3. Set your environment variables in .env.local
-- ============================================================
