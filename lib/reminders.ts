import { createAdminClient } from './supabase/server';
import { sendEmail } from './email';
import { renderReminderEmail, ReminderItem } from './emailTemplates';
import { Certification, PreferredLanguage } from './database.types';
import { logAudit } from './audit';

// How many days before expiration to send a reminder. A certification
// can trigger more than one threshold across separate runs (e.g. "30
// days left", then later "7 days left") — each threshold only ever
// fires once per certification, tracked in the `reminder_log` table.
export const REMINDER_THRESHOLDS = [30, 7] as const;

function daysUntil(dateStr: string): number {
  const today = new Date();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(dateStr);
  const targetUTC = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetUTC - todayUTC) / (1000 * 60 * 60 * 24));
}

export interface ReminderRunResult {
  certsFlagged: number;
  emailsSent: number;
  errors: string[];
}

// Core reminder job — called by both the scheduled cron route and the
// admin's manual "send now" button (see app/api/cron/expiration-reminders
// and app/api/admin/send-reminders). Finds approved certifications
// within REMINDER_THRESHOLDS days of expiring that haven't already
// triggered that threshold, groups them by client, and sends one email
// per client (in their preferred language) listing everything that's
// due. Only marks a threshold as "sent" for certs whose email actually
// went out — a transient email-provider failure just means it's
// retried on the next run instead of being silently skipped forever.
export async function runExpirationReminders(): Promise<ReminderRunResult> {
  const admin = createAdminClient();
  const errors: string[] = [];

  const { data: certs, error: certsError } = await admin
    .from('certifications')
    .select('*')
    .eq('approval_status', 'approved');

  if (certsError) {
    return { certsFlagged: 0, emailsSent: 0, errors: [certsError.message] };
  }

  const maxThreshold = Math.max(...REMINDER_THRESHOLDS);
  const upcoming = (certs ?? []).filter((c) => {
    const d = daysUntil(c.expiration_date);
    return d >= 0 && d <= maxThreshold;
  }) as Certification[];

  if (upcoming.length === 0) {
    return { certsFlagged: 0, emailsSent: 0, errors };
  }

  const certIds = upcoming.map((c) => c.id);
  const { data: logs } = await admin
    .from('reminder_log')
    .select('certification_id, threshold_days')
    .in('certification_id', certIds);

  const alreadySent = new Set((logs ?? []).map((l) => `${l.certification_id}:${l.threshold_days}`));

  // Which (cert, threshold) pairs are newly due, grouped by client.
  const byClient = new Map<
    string,
    { cert: Certification; days: number; thresholdsTriggered: number[] }[]
  >();

  for (const cert of upcoming) {
    const days = daysUntil(cert.expiration_date);
    const thresholdsTriggered = REMINDER_THRESHOLDS.filter(
      (threshold) => days <= threshold && !alreadySent.has(`${cert.id}:${threshold}`)
    );
    if (thresholdsTriggered.length === 0) continue;

    const list = byClient.get(cert.client_id) ?? [];
    list.push({ cert, days, thresholdsTriggered: [...thresholdsTriggered] });
    byClient.set(cert.client_id, list);
  }

  if (byClient.size === 0) {
    return { certsFlagged: 0, emailsSent: 0, errors };
  }

  const clientIds = Array.from(byClient.keys());
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, company_name, preferred_language')
    .in('id', clientIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const { data: authUsersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map((authUsersPage?.users ?? []).map((u) => [u.id, u.email]));

  const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.latinamericakosher.org';

  let emailsSent = 0;
  let certsFlagged = 0;
  const logRowsToInsert: { certification_id: string; threshold_days: number }[] = [];

  for (const [clientId, items] of byClient) {
    certsFlagged += items.length;

    const email = emailMap.get(clientId);
    if (!email) {
      errors.push(`No account email found for client ${clientId} — skipped`);
      continue;
    }

    const profile = profileMap.get(clientId);
    const lang = (profile?.preferred_language as PreferredLanguage) || 'es';
    const companyName = profile?.company_name || 'Valued Client';

    const reminderItems: ReminderItem[] = items
      .slice()
      .sort((a, b) => a.days - b.days)
      .map(({ cert, days }) => ({
        productName: cert.product_name,
        certificationNumber: cert.certification_number,
        expirationDate: cert.expiration_date,
        daysRemaining: days,
      }));

    const { subject, html } = renderReminderEmail({ lang, companyName, items: reminderItems, portalUrl });
    const result = await sendEmail({ to: email, subject, html });

    if (result.sent) {
      emailsSent++;
      for (const { cert, thresholdsTriggered } of items) {
        for (const threshold_days of thresholdsTriggered) {
          logRowsToInsert.push({ certification_id: cert.id, threshold_days });
        }
      }
    } else {
      errors.push(`${email}: ${result.error ?? 'send failed'}`);
      // Not logged — will be retried on the next scheduled run.
    }
  }

  if (logRowsToInsert.length > 0) {
    const { error: logError } = await admin
      .from('reminder_log')
      .upsert(logRowsToInsert, { onConflict: 'certification_id,threshold_days' });
    if (logError) errors.push(`Failed to record reminder log: ${logError.message}`);
  }

  await logAudit(admin, {
    userId: null,
    action: 'reminders.run',
    entityType: 'certification',
    details: { certsFlagged, emailsSent, errors: errors.length },
  });

  return { certsFlagged, emailsSent, errors };
}
