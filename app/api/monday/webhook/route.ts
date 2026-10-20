import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { mapMondayItem } from '@/lib/monday';

// POST /api/monday/webhook
//
// Register this URL with Monday.com (Board > Integrations > Webhooks,
// or via the API) to get near-instant updates when an item changes,
// instead of waiting for the periodic /api/monday/sync pull.
//
// SECURITY: Monday's webhook challenge/response and a shared secret
// are both handled below — see README.md "Connecting Monday.com" for
// how to register the webhook with the secret included in the URL,
// e.g. https://portal.../api/monday/webhook?secret=YOUR_SECRET
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');

  if (!process.env.MONDAY_WEBHOOK_SECRET || secret !== process.env.MONDAY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  // Monday sends a one-time "challenge" payload when you first register
  // the webhook — echo it back to confirm the endpoint is live.
  if (body?.challenge) {
    return NextResponse.json({ challenge: body.challenge });
  }

  const event = body?.event;
  if (!event || !event.pulseId) {
    return NextResponse.json({ ok: true, note: 'No item event to process' });
  }

  // A column changed on some item — re-fetch that single item fresh
  // (webhook payloads don't always include every column) and upsert it.
  const boardId = process.env.MONDAY_BOARD_ID;
  if (!boardId) {
    return NextResponse.json({ error: 'MONDAY_BOARD_ID not configured' }, { status: 500 });
  }

  const { fetchBoardItems } = await import('@/lib/monday');
  const items = await fetchBoardItems(boardId);
  const item = items.find((i) => i.id === String(event.pulseId));

  if (!item) {
    return NextResponse.json({ ok: true, note: 'Item not found on board' });
  }

  const mapped = mapMondayItem(item);
  if (!mapped) {
    return NextResponse.json({ ok: true, note: 'Item missing required fields, skipped' });
  }

  const admin = createAdminClient();

  const { data: authUsersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const userId = authUsersPage?.users.find(
    (u) => u.email?.toLowerCase() === mapped.client_email?.toLowerCase()
  )?.id;

  // A team member's email maps to their company's main account, which
  // owns the company's certifications.
  let clientId = userId;
  if (userId) {
    const { data: p } = await admin.from('profiles').select('company_owner_id').eq('id', userId).maybeSingle();
    if (p?.company_owner_id) clientId = p.company_owner_id;
  }

  if (!clientId) {
    return NextResponse.json({ ok: true, note: 'No matching client account for this email' });
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
  }

  return NextResponse.json({ ok: true });
}
