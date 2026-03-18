# diglist

A self-hosted listening list for Bandcamp hoarders.

Add releases and tracks you want to listen to, tag them, track your status, and embed Bandcamp players directly in the list. Your data lives in your own Supabase database. Multiple users can each maintain their own separate list.

> Vibe coded by an enthusiast. Bug fixes and contributions welcome.

## Features

- Add Bandcamp (and other) links with auto-fill from URL
- Album artwork fetched automatically from Bandcamp
- Embedded Bandcamp player per item
- Tags, notes, and status (to listen / listened)
- Filter by status and tag, search across all fields
- Sort by date added or alphabetically by artist
- Paginated list (10 items per page)
- Batch status edit and batch delete
- Import / export as JSON
- Magic link authentication (no passwords)
- Multi-user support — each user sees only their own list
- Public access request form — admin approves requests manually
- Data persists across devices via Supabase
- Mobile-friendly responsive layout

## Stack

- Vanilla HTML/JS — no framework, no build step
- [Netlify Functions](https://docs.netlify.com/functions/overview/) — serverless API proxy
- [Supabase](https://supabase.com) — Postgres database + Auth (magic links, RLS)
- [Resend](https://resend.com) — transactional email for magic link delivery

## Deploy your own

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run:

```sql
create table items (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now(),
  user_id uuid references auth.users(id)
);

alter table items enable row level security;

create policy "users see own items" on items
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  message text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

alter table access_requests enable row level security;

create policy "anon can insert requests" on access_requests
  for insert to anon with check (true);
```

3. Go to **Authentication → Sign In / Providers → Email** and:
   - Enable **Email** sign-in
   - Disable **Confirm email**
   - Disable **Allow new users to sign up** (invite-only — see step 5)

4. Go to **Authentication → URL Configuration** and set your site URL (e.g. `https://your-app.netlify.app` or your custom domain). Add the same URL to **Redirect URLs**. If you use branch deploys for staging (e.g. `https://dev--your-app.netlify.app`), add those URLs to the allowlist too — magic links dynamically redirect to whichever domain the login was requested from.

5. Go to **Project Settings → API** and copy your **Project URL** and **Publishable (anon) key**.

### 2. Resend (transactional email)

Supabase's built-in email sender has strict rate limits (3 emails/hour on the free tier). Use Resend for reliable magic link delivery.

1. Create an account at [resend.com](https://resend.com)
2. Go to **Domains → Add Domain** and enter your domain (e.g. `yourdomain.com`)
3. Add the DNS records Resend provides to your domain registrar:
   - One **TXT** record for DKIM verification (`resend._domainkey`)
   - One **MX** record for SPF (`send` subdomain, pointing to `feedback-smtp.us-east-1.amazonses.com`, priority 10)
   - One **TXT** record for SPF (`send` subdomain, `v=spf1 include:amazonses.com ~all`)
4. Wait for Resend to verify the domain (usually a few minutes)
5. Go to **API Keys → Create API key** with **Sending access**

6. In Supabase, go to **Authentication → Email** and configure SMTP:

| Field | Value |
|-------|-------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key |
| Sender email | `noreply@yourdomain.com` |
| Sender name | your app name |

### 3. Netlify

1. Fork this repo
2. Connect it to a new Netlify site
3. In **Site configuration → Environment variables**, add:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Your Supabase publishable (anon) key |
| `SUPABASE_SERVICE_KEY` | Your Supabase secret key (`sb_secret_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase legacy `service_role` JWT key |
| `ALLOWED_ORIGIN` | Your site URL (e.g. `https://yourapp.netlify.app`) |
| `RESEND_API_KEY` | Your Resend API key |
| `RESEND_FROM` | Sender email (e.g. `noreply@yourdomain.com`) |
| `ADMIN_EMAIL` | Your email — grants access to the requests panel |

4. Deploy

### 4. Inviting users

Public signups are disabled. Users request access via the form on the login screen.

1. Visitor submits their email + optional message via the **request access** form
2. You receive a notification email and see the request in the **requests** panel (purple button, visible only to the admin)
3. Approve or reject — approved users receive an email with instructions to log in via magic link

Each user gets their own isolated list. Data is separated at the database level via RLS.

## Local development

No build step required. The Netlify Functions in `netlify/functions/` require a Netlify environment to run. For local development, use the [Netlify CLI](https://docs.netlify.com/cli/get-started/):

```bash
npm install -g netlify-cli
netlify dev
```

## Architecture notes

- **Auth**: Supabase Auth magic links. JWTs are stored in `localStorage` and passed as `Authorization: Bearer` headers to Netlify Functions. No passwords anywhere. Sessions are silently refreshed when the access token expires — if the refresh token is also dead, the user is redirected to the login screen instead of seeing an error.
- **Data isolation**: Row Level Security in Postgres. Every query is automatically scoped to the authenticated user — even a bug in the JS cannot expose another user's data.
- **Email**: Resend via Supabase's custom SMTP configuration. The `auth.js` Netlify Function calls Supabase's OTP endpoint with `redirect_to` derived from the requesting page's origin, so magic links land on the correct domain (production or staging). The email is triggered by Supabase.
- **Future scaling**: If multi-tenant isolation needs to be stricter (e.g. GDPR compliance for a SaaS), the schema is ready to migrate to per-user databases (e.g. Turso). The `user_id` column is already in place.

## Contributing

Bug fixes and improvements are welcome.

1. Fork the repo
2. Create a branch from `dev`
3. Submit a PR against `dev` — Netlify will generate a deploy preview automatically
4. Once reviewed, changes are merged into `dev`, then into `main` for release

Please test your changes against a live Supabase instance before submitting.

## License

MIT