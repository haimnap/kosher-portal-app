import { Resend } from 'resend';

// Thin wrapper around Resend (resend.com) — a simple transactional email
// API. Free tier covers 3,000 emails/month, plenty for certification
// reminders. See README.md "Setting up email reminders" for signup +
// domain verification steps.
//
// If RESEND_API_KEY isn't set, sendEmail() logs a warning and no-ops
// instead of throwing — so the rest of the app (and local dev) keeps
// working even before email is configured.

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error?: string }> {
  const resend = getClient();

  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${to}: "${subject}"`);
    return { sent: false, error: 'Email is not configured (RESEND_API_KEY missing)' };
  }

  const from = process.env.RESEND_FROM_EMAIL || 'Latin America Kosher <onboarding@resend.dev>';

  const { error } = await resend.emails.send({ from, to, subject, html });

  if (error) {
    console.error(`[email] Failed to send to ${to}:`, error);
    return { sent: false, error: error.message };
  }

  return { sent: true };
}
