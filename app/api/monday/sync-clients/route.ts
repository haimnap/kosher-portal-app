import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { fetchClientRecords } from '@/lib/monday-clients';
import { logAudit } from '@/lib/audit';
import { isExcludedClientEmail } from '@/lib/client-email-filter';
import { transferCompanyOwnership } from '@/lib/company-accounts';

// POST /api/monday/sync-clients
// Staff/admin-triggered. Pulls every company from the configured Monday
// "Customer Companies" board and makes sure that EVERY person connected
// to it in Monday (its "Contacts" column, with an email) has a portal
// login for that company.
//
// How a company is stored:
//   * One "main" account per company owns its certifications
//     (profiles.company_owner_id = null, profiles.monday_item_id = the
//     Monday item id).
//   * Every other person is a team member: their own login, with
//     profiles.company_owner_id pointing at the main account. They see
//     exactly the same certifications.
//
// Important: this does NOT send any email. Accounts are created silently
// so an admin can review the list first — use the "Resend invitation"
// button on the Clients page whenever you're ready to invite someone.
//
// Addresses that must never get a client login (other kosher agencies,
// our own team, automatic no-reply senders — see lib/client-email-filter)
// are ignored even when they're connected in Monday.
//
// It never deletes anything. Accounts that look like they belong to a
// company but are no longer connected in Monday are only REPORTED
// (in `review`) so an admin can decide.

interface ProfileRow {
  id: string;
  role: string;
  company_name: string | null;
  contact_name: string | null;
  company_owner_id: string | null;
  monday_item_id: string | null;
}

function normalizeName(name: string | null | undefined): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export async function POST(_req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin' && me?.role !== 'staff') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  let records;
  try {
    records = await fetchClientRecords();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch from Monday' },
      { status: 500 }
    );
  }

  // Load everything once. listUsers() is capped per page — 1000 is far
  // above the current number of accounts.
  const { data: authUsersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const userIdByEmail = new Map<string, string>();
  const emailById = new Map<string, string>();
  for (const u of authUsersPage?.users ?? []) {
    if (!u.email) continue;
    userIdByEmail.set(u.email.toLowerCase(), u.id);
    emailById.set(u.id, u.email.toLowerCase());
  }

  const { data: profileRows, error: profilesError } = await admin
    .from('profiles')
    .select('id, role, company_name, contact_name, company_owner_id, monday_item_id');
  if (profilesError) {
    return NextResponse.json(
      {
        error:
          profilesError.message +
          ' — has the database update (supabase/migrations/003_company_members.sql) been run in Supabase?',
      },
      { status: 500 }
    );
  }
  const profiles = new Map<string, ProfileRow>((profileRows ?? []).map((p) => [p.id, p as ProfileRow]));

  // Accounts that already own certifications are never turned into team
  // members, so no certification is ever moved or hidden.
  const { data: certOwners } = await admin.from('certifications').select('client_id');
  const ownsCertifications = new Set((certOwners ?? []).map((c) => c.client_id as string));

  let companies = 0;
  let peopleCreated = 0;
  let peopleLinked = 0;
  let peopleUnchanged = 0;
  const skipped: { company: string | null; reason: string }[] = [];
  // userId is set when the person has a portal login (so the admin can
  // remove it straight from the sync result).
  const review: { company: string | null; email: string; reason: string; userId?: string }[] = [];

  // email -> Monday company it was assigned to in THIS run (detects one
  // person connected to two different companies).
  const claimedBy = new Map<string, string>();

  async function updateProfile(id: string, patch: Partial<ProfileRow>) {
    const { error } = await admin.from('profiles').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
    const current = profiles.get(id);
    if (current) profiles.set(id, { ...current, ...patch });
  }

  async function createPerson(email: string, companyName: string, contactName: string | null) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        role: 'client',
        company_name: companyName,
        contact_name: contactName,
        preferred_language: 'es',
      },
    });
    if (error || !data.user) throw new Error(error?.message || 'unknown_error');
    const id = data.user.id;
    userIdByEmail.set(email, id);
    emailById.set(id, email);
    profiles.set(id, {
      id,
      role: 'client',
      company_name: companyName,
      contact_name: contactName,
      company_owner_id: null,
      monday_item_id: null,
    });
    peopleCreated++;
    return id;
  }

  // Lists the logins that belong to a company but aren't (or can't be)
  // connected to it in Monday, so the admin can remove them.
  function reportUnconnected(companyName: string, mondayId: string, ownerId: string | undefined, connected: Set<string>) {
    const target = normalizeName(companyName);
    for (const p of profiles.values()) {
      if (p.role !== 'client') continue;
      const belongs =
        (ownerId && (p.id === ownerId || p.company_owner_id === ownerId)) ||
        (!p.company_owner_id && p.monday_item_id === mondayId) ||
        (!p.company_owner_id && !p.monday_item_id && normalizeName(p.company_name) === target);
      if (!belongs) continue;
      const email = emailById.get(p.id);
      if (email && !connected.has(email)) {
        review.push({
          company: companyName,
          email,
          reason: isExcludedClientEmail(email) ? 'excluded_address' : 'not_connected_in_monday',
          userId: p.id,
        });
      }
    }
  }

  for (const record of records) {
    const companyName = record.company_name;
    if (!companyName) {
      skipped.push({ company: null, reason: 'missing_name' });
      continue;
    }
    if (record.contacts.length === 0) {
      skipped.push({ company: companyName, reason: 'missing_email' });
      reportUnconnected(companyName, record.monday_item_id, undefined, new Set());
      continue;
    }

    const mondayId = record.monday_item_id;

    // Contacts we may use for this company: not staff/admin accounts, and
    // not already used by another Monday company in this run.
    const usable = record.contacts.filter((c) => {
      if (isExcludedClientEmail(c.email)) return false;
      const existingId = userIdByEmail.get(c.email);
      const existing = existingId ? profiles.get(existingId) : undefined;
      if (existing && existing.role !== 'client') {
        review.push({ company: companyName, email: c.email, reason: 'staff_account' });
        return false;
      }
      const other = claimedBy.get(c.email);
      if (other && other !== mondayId) {
        review.push({ company: companyName, email: c.email, reason: 'connected_to_two_companies' });
        return false;
      }
      return true;
    });

    if (usable.length === 0) {
      skipped.push({ company: companyName, reason: 'missing_email' });
      reportUnconnected(companyName, mondayId, undefined, new Set());
      continue;
    }

    // ── 1. Find (or create) the company's main account ──────────────
    let ownerId: string | undefined;

    // a) The account already linked to this Monday company — unless its
    //    address must not have a client login (e.g. an agency address that
    //    became the main account earlier). Then another person of the
    //    company takes over as main account below.
    let demoteOwnerId: string | undefined;
    for (const p of profiles.values()) {
      if (p.role === 'client' && p.monday_item_id === mondayId && !p.company_owner_id) {
        const email = emailById.get(p.id);
        if (email && isExcludedClientEmail(email)) demoteOwnerId = p.id;
        else ownerId = p.id;
        break;
      }
    }

    // b) An existing main account of one of the connected people that
    //    isn't linked to a different Monday company. An account that
    //    already has products is only used if it's for this same company
    //    name (so another company's products are never relabelled); and
    //    such an account is preferred, so the products stay visible.
    const target = normalizeName(companyName);
    if (!ownerId) {
      const candidates = usable
        .map((c) => profiles.get(userIdByEmail.get(c.email) ?? ''))
        .filter(
          (p): p is ProfileRow =>
            !!p &&
            (!p.company_owner_id || p.company_owner_id === demoteOwnerId) &&
            (!p.monday_item_id || p.monday_item_id === mondayId) &&
            (!ownsCertifications.has(p.id) || normalizeName(p.company_name) === target)
        );
      ownerId = (candidates.find((p) => ownsCertifications.has(p.id)) ?? candidates[0])?.id;
    }

    try {
      // c) Nobody has an account yet — the first connected person's new
      //    account becomes the main one.
      if (!ownerId) {
        const first = usable.find((c) => !userIdByEmail.has(c.email));
        if (!first) {
          skipped.push({ company: companyName, reason: 'contacts_belong_to_other_company' });
          continue;
        }
        ownerId = await createPerson(first.email, companyName, first.name);
      }

      if (demoteOwnerId && demoteOwnerId !== ownerId) {
        await transferCompanyOwnership(admin, demoteOwnerId, ownerId);
        const newOwnerId = ownerId;
        const old = profiles.get(demoteOwnerId)!;
        for (const p of profiles.values()) {
          if (p.company_owner_id === demoteOwnerId && p.id !== newOwnerId) p.company_owner_id = newOwnerId;
        }
        profiles.set(newOwnerId, {
          ...profiles.get(newOwnerId)!,
          company_owner_id: null,
          monday_item_id: old.monday_item_id,
        });
        profiles.set(demoteOwnerId, { ...old, company_owner_id: newOwnerId, monday_item_id: null });
        if (ownsCertifications.has(demoteOwnerId)) {
          ownsCertifications.delete(demoteOwnerId);
          ownsCertifications.add(newOwnerId);
        }
      }

      const owner = profiles.get(ownerId)!;
      if (owner.monday_item_id !== mondayId || owner.company_name !== companyName) {
        await updateProfile(ownerId, { monday_item_id: mondayId, company_name: companyName });
      }
      companies++;

      // ── 2. Make every connected person part of this company ────────
      for (const c of usable) {
        claimedBy.set(c.email, mondayId);
        let id = userIdByEmail.get(c.email);

        if (!id) {
          id = await createPerson(c.email, companyName, c.name);
          await updateProfile(id, { company_owner_id: ownerId });
          continue;
        }

        const p = profiles.get(id);
        if (!p) continue;

        if (id === ownerId) {
          if (!p.contact_name && c.name) await updateProfile(id, { contact_name: c.name });
          peopleUnchanged++;
          continue;
        }

        if (p.company_owner_id === ownerId) {
          const patch: Partial<ProfileRow> = {};
          if (p.company_name !== companyName) patch.company_name = companyName;
          if (!p.contact_name && c.name) patch.contact_name = c.name;
          if (Object.keys(patch).length) await updateProfile(id, patch);
          peopleUnchanged++;
          continue;
        }

        // This person currently has a separate account of their own.
        if (ownsCertifications.has(id)) {
          review.push({ company: companyName, email: c.email, reason: 'has_own_certifications' });
          continue;
        }
        if (!p.company_owner_id && p.monday_item_id && p.monday_item_id !== mondayId) {
          review.push({ company: companyName, email: c.email, reason: 'connected_to_two_companies' });
          continue;
        }

        await updateProfile(id, {
          company_owner_id: ownerId,
          company_name: companyName,
          monday_item_id: null,
          contact_name: p.contact_name || c.name,
        });
        peopleLinked++;
      }
    } catch (err) {
      skipped.push({ company: companyName, reason: err instanceof Error ? err.message : 'unknown_error' });
      continue;
    }

    // ── 3. Report accounts of this company that Monday doesn't list ──
    reportUnconnected(companyName, mondayId, ownerId, new Set(usable.map((c) => c.email)));
  }

  await logAudit(supabase, {
    userId: user.id,
    action: 'monday.sync_clients',
    entityType: 'profile',
    details: {
      companies,
      peopleCreated,
      peopleLinked,
      peopleUnchanged,
      skipped: skipped.length,
      review: review.length,
      total: records.length,
    },
  });

  return NextResponse.json({
    companies,
    peopleCreated,
    peopleLinked,
    peopleUnchanged,
    skipped,
    review,
    total: records.length,
  });
}
