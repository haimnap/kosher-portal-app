import { NextRequest, NextResponse } from 'next/server';
import { runExpirationReminders } from '@/lib/reminders';

// GET /api/cron/expiration-reminders
//
// Called automatically by Vercel Cron on the schedule in vercel.json
// (daily by default). Vercel automatically sends
// `Authorization: Bearer $CRON_SECRET` on cron-triggered requests once
// CRON_SECRET is set as an environment variable — this route just
// verifies that header matches before doing anything.
//
// You can also hit this manually (e.g. with curl) for testing:
//   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
//     https://portal.latinamericakosher.org/api/cron/expiration-reminders
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runExpirationReminders();

  return NextResponse.json(result);
}
