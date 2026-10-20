import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { fetchBoardItems, mapMondayItem } from '@/lib/monday';
import { logAudit } from '@/lib/audit';

// POST /api/monday/sync
// Staff/admin-triggered (button in the admin panel, or a cron job hitting
// this endpoint on a schedule). Pulls every item from the configured
// Monday board and upserts matching certifications.
//
// New products land as `approval_status = pending` so your team still
// reviews before a client sees them — this only automates data entry,
// not the approval decision.
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

  const boardId = process.env.MONDAY_BOARD_ID;
  if (!boardId) {
    return NextResponse.json({ error: 'MONDAY_BOARD_ID is not configured' }, { status: 500 });
  }

  const admin = createAdminClient();
  const items = await fetchBoardItems(boardId);

  // Fetch all auth users once (not per-item) to match Monday's "client
  // email" column against the client's portal login email. Note:
  // listUsers() paginates at 50/page by default — if you have more than
  // a handful of clients, bump { perPage } here or paginate through it.
  const { data: authUsersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailToClientId = new Map(
    (authUsersPage?.users ?? [])
      .filter((u) => u.email)
      .map((u) => [u.email!.toLowerCase(), u.id])
  );

  // A team member's email maps to their company's main account, which is
  // the one that owns the company's certifications.
  const { data: ownerRows } = await admin.from('profiles').select('id, company_owner_id');
  const ownerOf = new Map((ownerRows ?? []).map((p) => [p.id as string, (p.company_owner_id as string | null) ?? null]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const mapped = mapMondayItem(item);
    if (!mapped) {
      skipped++;
      continue;
    }

    const userId = emailToClientId.get(mapped.client_email?.toLowerCase() ?? '');
    const clientId = userId ? ownerOf.get(userId) || userId : undefined;

    if (!clientId) {
      skipped++;
      continue; // no matching client account — create one first, or fix the email in Monday
    }

    const { data: existing } = await admin
      .from('certifications')
      .select('id')
      .eq('monday_item_id', mapped.monday_item_id)
      .maybeSingle();

    if (existing) {
      await admin
        .from('certifications')
        .update({
          product_name: mapped.product_name,
          product_category: mapped.product_category,
          certification_number: mapped.certification_number,
          date_issued: mapped.date_issued,
          expiration_date: mapped.expiration_date,
          mashguiach_notes: mapped.mashguiach_notes,
        })
        .eq('id', existing.id);
      updated++;
    } else {
      await admin.from('certifications').insert({
        client_id: clientId,
        monday_item_id: mapped.monday_item_id,
        product_name: mapped.product_name,
        product_category: mapped.product_category,
        certification_number: mapped.certification_number,
        date_issued: mapped.date_issued,
        expiration_date: mapped.expiration_date,
        mashguiach_notes: mapped.mashguiach_notes,
        approval_status: 'pending',
      });
      created++;
    }
  }

  await logAudit(supabase, {
    userId: user.id,
    action: 'monday.sync',
    entityType: 'certification',
    details: { created, updated, skipped, total: items.length },
  });

  return NextResponse.json({ created, updated, skipped, total: items.length });
}
