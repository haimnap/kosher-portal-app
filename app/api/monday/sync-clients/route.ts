import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { fetchClientRecords } from '@/lib/monday-clients';
import { logAudit } from '@/lib/audit';

// POST /api/monday/sync-clients
// Staff/admin-triggered. Pulls every company from the configured Monday
// "Customer Companies" board and creates a matching client account for
// each one that has a company name and a resolvable email.
//
// Important: this does NOT send any email. Accounts are created silently
// so an admin can review the imported list first — use the "Resend
// invitation" button on the Clients page whenever you're ready to
// actually invite a given client to log in.
export async function POST(_req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'staff') {
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

  // Fetch all existing auth users once (not per-record) to check for
  // duplicates. listUsers() paginates at a default of 50/page — bump
  // perPage here if you have more than 1000 total accounts.
  const { data: authUsersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existingEmails = new Set(
    (authUsersPage?.users ?? []).map((u) => u.email?.toLowerCase()).filter((e): e is string => !!e)
  );

  let created = 0;
  let alreadyExists = 0;
  const skipped: { company: string | null; reason: string }[] = [];

  for (const record of records) {
    if (!record.company_name) {
      skipped.push({ company: record.company_name, reason: 'missing_name' });
      continue;
    }
    if (!record.email) {
      skipped.push({ company: record.company_name, reason: 'missing_email' });
      continue;
    }
    if (existingEmails.has(record.email.toLowerCase())) {
      alreadyExists++;
      continue;
    }

    const { data: createdUser, error } = await admin.auth.admin.createUser({
      email: record.email,
      email_confirm: true,
      user_metadata: {
        role: 'client',
        company_name: record.company_name,
        preferred_language: 'es',
      },
    });

    if (error || !createdUser.user) {
      skipped.push({ company: record.company_name, reason: error?.message || 'unknown_error' });
      continue;
    }

    existingEmails.add(record.email.toLowerCase());
    created++;
  }

  await logAudit(supabase, {
    userId: user.id,
    action: 'monday.sync_clients',
    entityType: 'profile',
    details: { created, alreadyExists, skipped: skipped.length, total: records.length },
  });

  return NextResponse.json({ created, alreadyExists, skipped, total: records.length });
}
