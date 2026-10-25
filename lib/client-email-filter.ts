// Which email addresses must never get a client login, even when they are
// connected to a company in Monday.
//
// Monday "Contacts" also collects people who simply emailed about a
// company: other kosher agencies, our own team, automatic bounce /
// no-reply senders… Those must not be able to log in as the client.
//
// Extra domains or addresses can be added without changing code through
// the Vercel environment variable PORTAL_EXCLUDED_EMAILS — a comma
// separated list, e.g. "kmd.org, someone@gmail.com".

const EXCLUDED_DOMAINS = [
  // Other kosher certification agencies
  'ou.org',
  'ok.org',
  'star-k.org',
  'kof-k.org',
  'crcweb.org',
  'koshercertifications.in',
  // Our own team
  'latinamericakosher.org',
];

// Automatic senders (bounces, no-reply addresses).
const EXCLUDED_LOCAL_PARTS = [
  'mailer-daemon',
  'postmaster',
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'bounce',
  'bounces',
];

function extraExclusions(): string[] {
  return (process.env.PORTAL_EXCLUDED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isExcludedClientEmail(email: string): boolean {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf('@');
  if (at < 0) return true;
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);

  const matchesDomain = (d: string) => domain === d || domain.endsWith('.' + d);

  if (EXCLUDED_DOMAINS.some(matchesDomain)) return true;
  if (EXCLUDED_LOCAL_PARTS.includes(local)) return true;
  // Kosher-certification mailboxes on free email services, e.g.
  // "jerusalemkosher@gmail.com", "mykosher@…".
  if (local.includes('kosher')) return true;

  for (const extra of extraExclusions()) {
    if (extra.includes('@') ? address === extra : matchesDomain(extra.replace(/^@/, ''))) return true;
  }
  return false;
}
