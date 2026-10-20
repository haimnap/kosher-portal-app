-- ============================================================
-- 003 — Several people per client company
-- ============================================================
-- Until now every client login WAS a company. From this migration on,
-- a company can have several people (one login each), all seeing the
-- same certifications:
--
--   * The company's main account ("owner") keeps owning the
--     certifications (certifications.client_id = owner's id), exactly
--     as before.
--   * Every other person of that company gets their own login whose
--     profiles.company_owner_id points at the owner.
--   * profiles.monday_item_id remembers which Monday "Customer
--     Companies" item a company account came from, so re-syncing
--     always finds the same company again.
--
-- Safe to run more than once.
-- Run in: Supabase Dashboard > SQL Editor > New query > paste > Run
-- ============================================================

alter table profiles add column if not exists company_owner_id uuid references profiles(id) on delete set null;
alter table profiles add column if not exists monday_item_id text;

create index if not exists idx_profiles_company_owner on profiles(company_owner_id);
create index if not exists idx_profiles_monday_item on profiles(monday_item_id);

-- The company a logged-in user belongs to: the owner's id for team
-- members, the user's own id for company owners (and for staff).
create or replace function my_company_id()
returns uuid
language sql
security definer
stable
as $$
  select coalesce((select company_owner_id from profiles where id = auth.uid()), auth.uid());
$$;

grant execute on function my_company_id() to authenticated;

-- People may read their own profile AND their company's main profile
-- (needed to show the company name); staff/admin read everything.
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id or id = my_company_id() or is_staff());

-- Everyone in a company sees that company's certifications.
drop policy if exists "Clients view own certifications" on certifications;
create policy "Clients view own certifications"
  on certifications for select
  using (client_id = my_company_id() or is_staff());

-- Clients may edit their own profile (name, phone, language…) but must
-- never be able to change their role or which company they belong to —
-- otherwise someone could make themselves admin, or join another company
-- and see its products. Staff/admin and the server (service role) can.
create or replace function protect_profile_columns()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.uid() is not null and not is_staff() then
    if new.role is distinct from old.role
       or new.company_owner_id is distinct from old.company_owner_id
       or new.monday_item_id is distinct from old.monday_item_id then
      raise exception 'Not allowed to change role or company';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_columns on profiles;
create trigger protect_profile_columns before update on profiles
  for each row execute procedure protect_profile_columns();

-- The certifications_with_status view must follow the same rules as the
-- certifications table (Supabase showed it as "UNRESTRICTED": through it,
-- any logged-in client could read every company's products).
alter view certifications_with_status set (security_invoker = true);
