-- ============================================================
-- Migration 002: Email reminders + multi-language support
--
-- Run this in Supabase's SQL Editor if you already ran the original
-- schema.sql. (If you're setting up fresh, schema.sql already
-- includes everything below — you don't need to run this separately.)
-- ============================================================

-- Each client's preferred language for portal defaults and for the
-- language their reminder emails are sent in.
alter table profiles
  add column if not exists preferred_language text not null default 'es'
    check (preferred_language in ('es', 'en', 'pt'));

-- Tracks which expiration-reminder emails have already been sent, so
-- the scheduled job never emails a client twice for the same
-- certification + urgency threshold (e.g. "30 days left" only goes
-- out once per certification, even if the job runs daily).
create table if not exists reminder_log (
  id uuid primary key default uuid_generate_v4(),
  certification_id uuid not null references certifications(id) on delete cascade,
  threshold_days integer not null,
  sent_at timestamptz not null default now(),
  unique (certification_id, threshold_days)
);

create index if not exists idx_reminder_log_certification on reminder_log(certification_id);

alter table reminder_log enable row level security;

drop policy if exists "Staff view reminder log" on reminder_log;
create policy "Staff view reminder log"
  on reminder_log for select
  using (is_staff());

-- Reminder emails are sent by server-side jobs using the service role
-- key, which bypasses RLS entirely — no insert policy is needed for
-- normal operation. This one exists only as a safety net in case a
-- future authenticated (non-service-role) code path needs to log a
-- reminder directly.
drop policy if exists "Staff insert reminder log" on reminder_log;
create policy "Staff insert reminder log"
  on reminder_log for insert
  with check (is_staff());
