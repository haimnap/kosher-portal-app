# Latin America Kosher — Certification Portal

A self-service portal for kosher certification clients: your team manages
and approves certifications, and clients log in to view and print their
own certificates on demand.

Built with **Next.js 14 + Supabase (Postgres + Auth) + React PDF**, deployed
on **Vercel**. No servers to manage.

---

## What this replaces

**Before:** mashguiach emails you → data goes into Monday.com → your team
reviews → someone manually writes a certificate → emails it to the client.

**After:** mashguiach enters data in Monday (or you enter it directly in
the portal) → your team approves with one click → the client logs into
their own dashboard and prints exactly the certificates they need,
whenever they need them.

---

## 1. Prerequisites

- A [Supabase](https://supabase.com) account (free tier works for testing;
  Pro tier ~$25/mo recommended for production)
- A [Vercel](https://vercel.com) account (free tier works for low traffic)
- Node.js 18+ installed locally (only needed if you want to run it on
  your own machine before deploying — Vercel builds it for you otherwise)
- Optional: a [Monday.com](https://monday.com) account with API access,
  if you want to keep using your existing board

---

## 2. Set up Supabase (your database + login system)

1. Go to [supabase.com](https://supabase.com) → **New Project**.
   - Name it something like `kosher-portal`
   - Choose a strong database password and **save it somewhere safe**
   - Pick the region closest to your clients (likely US East or a
     Latin America-adjacent region)

2. Once the project is created, go to **SQL Editor** → **New Query**.
   Open `supabase/schema.sql` from this project, paste its entire
   contents, and click **Run**. This creates all the tables, security
   rules, and helper functions.

3. Go to **Authentication → Providers** and confirm **Email** is enabled
   (it is by default).

4. Go to **Authentication → Email Templates** and customize the "Invite
   user" and "Reset password" templates with your branding if you like
   (optional, but recommended before going live with real clients).

5. Go to **Settings → API**. You'll need three values for the next step:
   - `Project URL`
   - `anon` `public` key
   - `service_role` `secret` key (⚠️ keep this one truly secret — it
     bypasses all security rules)

### Creating your first admin account

Since new signups default to `role = 'client'`, you need to manually
promote your own account to admin the first time:

1. In the portal (once deployed, or running locally), go to `/login`
   and note you don't have an account yet — instead, go to **Supabase
   Dashboard → Authentication → Users → Add User** and create yourself
   an account with your email and a password.
2. Go to **Table Editor → profiles**, find the row matching your user
   ID, and change its `role` column from `client` to `admin`.
3. Now log into the portal with that email/password — you'll land on
   `/admin`.

---

## 3. Environment variables

Copy `.env.example` to `.env.local` (for local dev) and fill in the
values from Supabase step 2.5 above:

```bash
cp .env.example .env.local
```

You can leave the `MONDAY_*` variables blank if you're not connecting
Monday.com yet — the portal works fine without it (your team just adds
certifications directly through **Admin → Add Certification**).

---

## 4. Run it locally (optional, to test before deploying)

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — you should be redirected to `/login`.

---

## 5. Deploy to Vercel

1. Push this project to a GitHub repository (private is fine).
2. Go to [vercel.com/new](https://vercel.com/new) and import that
   repository.
3. In the import screen, add the same environment variables from
   `.env.local` (Vercel has a UI for this — paste them in one at a
   time, or use their "paste .env" bulk option).
4. Click **Deploy**. Vercel gives you a `*.vercel.app` URL immediately.

### Connecting your domain

1. In Vercel: **Project → Settings → Domains** → add
   `portal.latinamericakosher.org` (a subdomain keeps your main site
   untouched).
2. Vercel shows you a DNS record to add (usually a `CNAME`). Add that
   record wherever `latinamericakosher.org`'s DNS is managed (your
   domain registrar or DNS host).
3. Wait a few minutes for DNS to propagate — Vercel auto-issues an SSL
   certificate once it verifies the domain.

---

## 6. Adding your first real client

**Admin → Clients → New Client.** Enter their company name and email.
This sends them an invitation email (via Supabase Auth) with a link to
set their own password — they never see a temporary password, and you
never have to email one manually.

Once they've set a password, add their certifications under
**Admin → Certifications → Add Certification**, or connect Monday.com
so their products sync in automatically (below).

---

## 7. Connecting Monday.com (optional, but recommended)

This lets your mashguiach keep working in Monday.com exactly as before
— the portal pulls new/updated items in automatically.

### 7a. Get your API token

Monday.com → click your avatar (bottom left) → **Admin** → **API** →
copy your personal token. Put it in `MONDAY_API_TOKEN`.

### 7b. Find your board ID

Open your certifications board in Monday.com — the ID is the number in
the URL, e.g. `https://yourteam.monday.com/boards/1234567890`. Put it
in `MONDAY_BOARD_ID`.

### 7c. Map your board's columns

The portal needs to know which of your board's columns hold which
piece of data. Open your board, click a column header's **⋯** menu →
inspect its ID (or use Monday's API Playground with a query like
`{ boards(ids: [YOUR_BOARD_ID]) { columns { id title } } }`), then set:

```
MONDAY_COL_CLIENT_EMAIL=  # column with the client's email address
MONDAY_COL_CATEGORY=      # product category column
MONDAY_COL_CERT_NUMBER=   # certification number column
MONDAY_COL_DATE_ISSUED=   # date issued column
MONDAY_COL_EXPIRATION=    # expiration date column
MONDAY_COL_NOTES=         # mashguiach notes column
```

The product name itself is read from the Monday item's name (the first
column), so no mapping needed there.

**Important:** the client email column must match the email address of
an existing client account in the portal — that's how the portal knows
which client a Monday item belongs to. Create the client account first
(step 6), then reference their email in Monday.

### 7d. Manual sync

Once the columns are mapped and deployed, go to **Admin dashboard →
Sync from Monday.com**. This pulls every item from the board and
creates/updates matching certifications (as `pending`, so your team
still reviews before clients see them).

### 7e. Real-time sync via webhook (optional)

Instead of clicking "sync" manually, Monday.com can push updates the
moment something changes:

1. Choose a random secret string and set it as `MONDAY_WEBHOOK_SECRET`
   in your environment variables (redeploy after adding it).
2. In Monday.com, go to your board → **Integrations** → search for
   "Webhooks" → **When a column changes, send a webhook** (or use the
   API directly — see
   [Monday's webhook docs](https://developer.monday.com/api-reference/docs/webhooks)).
3. Set the webhook URL to:
   ```
   https://portal.latinamericakosher.org/api/monday/webhook?secret=YOUR_SECRET
   ```
4. Monday will send a one-time verification request — the portal
   handles this automatically.

### 7f. Importing your client list from Monday.com

If you already keep your clients in a Monday.com CRM board (a
"Customer Companies"-style board with a company name, and a linked
contact who has an email), the portal can import them as client
accounts directly — no need to add each one by hand.

1. Open that board in Monday.com — the ID is the number in the URL,
   e.g. `https://yourteam.monday.com/boards/1234567890`. Put it in
   `MONDAY_CLIENTS_BOARD_ID` (redeploy after adding it).
2. Make sure `MONDAY_API_TOKEN` is also set (same token as step 7a —
   this sync reuses it).
3. Go to **Admin → Clients → Sync Clients from Monday.com**.

For each company, the portal uses the email of its first linked
contact that has one filled in (falling back to the company's own
email column if none of its contacts do). Companies missing both a
name and an email are skipped and listed in the result so you can fix
them in Monday and re-run the sync.

**Important — this does NOT email anyone automatically.** Imported
clients show up with a "Pending" badge and no password yet. When
you're ready to actually invite a given client to log in, click
**"Resend invitation"** next to their name — that sends them a real
email with a link to set their password. This lets you review the
imported list (and clean up any bad data) before any client hears
from the portal.

Re-running the sync later is safe — companies that already have an
account (matched by email) are left untouched, not duplicated.

---

## 8. The portal is trilingual (Spanish / English / Portuguese)

Every screen — client and admin — has a language switcher (top right)
that instantly changes the whole interface, no reload delay. Spanish is
the default for new visitors; each person's choice is remembered
(stored in a cookie) so it sticks on their next visit.

Certificates also print in whichever language is currently selected
when the client clicks download — so a client can switch to English,
download an English certificate, switch back, and their portal stays
in their preferred language.

Each client also has a **preferred language** set on their profile
(chosen when you invite them, editable any time in Supabase's Table
Editor under `profiles → preferred_language`) — this is what
determines the language of their *automated* reminder emails, since
those are sent without the client having a browser session open.

To add a fourth language later: open `lib/i18n/dictionaries.ts`, copy
the `en` object, translate every value, add it to the `dictionaries`
export, and add the language code to `LANGUAGES` in
`lib/i18n/config.ts`. Every screen picks it up automatically — no
other files to touch.

---

## 9. Automated expiration reminder emails

Clients get an email automatically **30 days** and again **7 days**
before a certification expires, listing every product that's due,
in their preferred language. Each reminder only ever sends once per
certification per threshold — the portal tracks this in the
`reminder_log` table, so nobody gets double-emailed even if the job
runs more than once.

### 9a. Set up Resend (the email provider)

1. Sign up free at [resend.com](https://resend.com) (3,000 emails/month
   free, plenty for this).
2. **API Keys** → **Create API Key** → copy it into `RESEND_API_KEY`.
3. For real production sending, verify your domain: **Domains** → **Add
   Domain** → enter `latinamericakosher.org` → add the DNS records
   Resend shows you (similar process to the portal subdomain setup —
   same place you added the `portal` CNAME). Once verified, set:
   ```
   RESEND_FROM_EMAIL="Latin America Kosher <notifications@latinamericakosher.org>"
   ```
   Until you verify a domain, you can test with Resend's default
   `onboarding@resend.dev` sender, but it can only deliver to the
   email address on your own Resend account — fine for testing, not
   for real clients.

### 9b. Set up the scheduled job

1. Generate a random secret: run `openssl rand -hex 32` in a terminal
   (or use any password generator), and set it as `CRON_SECRET`.
2. That's it — `vercel.json` already defines the schedule (daily at
   13:00 UTC). Vercel automatically picks this up on deploy and
   securely calls the reminder endpoint on schedule; no dashboard
   clicking required. Change the time by editing the `schedule` cron
   expression in `vercel.json` if 13:00 UTC isn't convenient for your
   timezone.
   
   Note: Vercel's free (Hobby) plan supports daily cron jobs, which is
   exactly what this uses — no paid plan needed for this feature.

### 9c. Test it

Once deployed with both `RESEND_API_KEY` and `CRON_SECRET` set, go to
**Admin Dashboard → Send Expiration Reminders Now**. This runs the
exact same job on demand, so you can confirm it's working without
waiting for the schedule (and without needing a cert that's actually
about to expire — just temporarily set a test certification's
expiration date to within 30 days).

### 9d. Customizing

- Change the reminder timing (currently 30 and 7 days before
  expiration) by editing `REMINDER_THRESHOLDS` in `lib/reminders.ts`.
- Change the email's design/wording by editing
  `lib/emailTemplates.ts` (and the `email.*` keys in
  `lib/i18n/dictionaries.ts` for the translated text).

---

## 10. How the pieces fit together

```
app/
  login/              Client + staff login (same page, redirected by role)
  reset-password/     Password reset flow
  dashboard/          CLIENT-FACING: product list, stats, filters
  dashboard/print/    CLIENT-FACING: select products, download PDF
  admin/              STAFF-FACING: KPIs, pending approvals, quick actions
  admin/certifications/  Full certification list + add new
  admin/clients/          Client list + invite new
  api/certificates/generate/  Generates the PDF certificate(s)
  api/monday/sync/            Pulls certifications from Monday.com on demand
  api/monday/sync-clients/    Imports the client list from Monday.com (no emails sent)
  api/monday/webhook/         Receives real-time pushes from Monday.com

  api/cron/expiration-reminders/  Scheduled reminder job (Vercel Cron)
  api/admin/send-reminders/       Manual "send now" trigger for admins

lib/
  supabase/client.ts   Browser-side Supabase client
  supabase/server.ts   Server-side client (+ admin client for privileged ops)
  actions.ts           Server Actions: approve/reject/create certifications & clients
  monday.ts            Monday.com API wrapper + certification column mapping
  monday-clients.ts    Monday.com client-list import (company + contact email lookup)
  CertificatePDF.tsx   The actual certificate PDF template/design (translated)
  status.ts            Computes active/expiring/expired from dates
  reminders.ts         Core expiration-reminder logic (shared by cron + manual trigger)
  email.ts             Resend wrapper for sending transactional email
  emailTemplates.ts    The reminder email's HTML template (translated)
  i18n/dictionaries.ts All UI + email text in Spanish, English, Portuguese
  i18n/server.ts       Server-side "what language is this request in" helper
  i18n/config.ts       Supported languages, default language, cookie name

components/i18n/
  LanguageProvider.tsx Client-side language context + the `useTranslation()` hook
  LanguageSwitcher.tsx The ES/EN/PT toggle used in both headers

supabase/
  schema.sql           Run this once in Supabase's SQL Editor to set everything up
  migrations/          Incremental migrations (for updating an already-running portal)
  seed.sql             Optional sample data for testing
```

---

## 11. Security notes

- **Row Level Security** (in `schema.sql`) means clients can only ever
  query their own certifications — this is enforced by the database
  itself, not just the app code, so it holds even if there's a bug in
  the frontend.
- The `service_role` key (`SUPABASE_SERVICE_ROLE_KEY`) bypasses all of
  that. It's only used server-side, in `lib/actions.ts` (inviting
  clients) and the Monday.com sync routes. Never expose it to the
  browser or commit it to git.
- Every approve/reject/create/print action writes a row to
  `audit_logs` — query that table any time you need to know who did
  what and when.
- `.env.local` is already in `.gitignore` — never commit real
  credentials.

---

## 12. Customizing the certificate design

Edit `lib/CertificatePDF.tsx` — it's a React component (using
`@react-pdf/renderer`) so the styling works like normal CSS-in-JS.
Add your logo by importing an image and adding an `<Image>` element;
see the [react-pdf docs](https://react-pdf.org/) for the full API.
The certificate's text comes from the `certificate.*` keys in
`lib/i18n/dictionaries.ts` — edit those to change the wording in any
of the three languages.

---

## 13. Updating an already-running portal

If you already deployed and ran the original `schema.sql` before the
language and reminder features existed, run
`supabase/migrations/002_email_reminders_and_language.sql` in
Supabase's SQL Editor to add the new `preferred_language` column and
`reminder_log` table without touching your existing data. (A fresh
install can skip this — `schema.sql` already includes everything.)

---

## 14. Possible next steps

- **Reports/analytics page** — counts and trends over time beyond the
  current dashboard's snapshot view.
- **Bulk CSV import** for migrating historical certifications in one
  shot instead of one-by-one or via Monday sync.
- **Post-expiration follow-up emails** — the current reminders only
  fire before expiration (30 and 7 days out); a similar job could
  nudge clients who let something lapse.

None of these are required to launch — the portal is fully functional
without them.
