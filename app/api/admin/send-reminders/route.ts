import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runExpirationReminders } from '@/lib/reminders';

// POST /api/admin/send-reminders
//
// Lets a logged-in admin/staff member trigger the reminder job
// on-demand from the dashboard (see components/SendRemindersButton),
// instead of waiting for the scheduled cron run. Same underlying logic
// as /api/cron/expiration-reminders — this route just authenticates
// differently (an admin session instead of CRON_SECRET).
export async function POST() {
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

  const result = await runExpirationReminders();

  return NextResponse.json(result);
}
