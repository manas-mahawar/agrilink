# Supabase setup

You need **one** Supabase project for the real site. A **second, separate** project is
optional, for a public demo with sample data. Never put demo data in the real project.

Everything below is done in the browser at <https://supabase.com/dashboard>. It takes about
20 minutes.

---

## 1. Create the production project

1. **New project** → name it `agrilink-prod`.
2. **Region:** *Mumbai (ap-south-1)* — closest to Patiala.
3. Choose a strong database password and save it in your password manager. You will rarely
   need it, but you cannot see it again.
4. Wait for the project to finish setting up.

## 2. Create the database (run the migrations)

The whole database — tables, security rules, functions, photo storage — is in the
`supabase/migrations` folder, as 8 files numbered in order.

**Option A — SQL Editor (no tools needed)**

1. Open **SQL Editor** → **New query**.
2. Open `supabase/migrations/20261021000100_foundation.sql` in a text editor (Notepad is
   fine), copy everything, paste it into the SQL editor and click **Run**. You should see
   "Success. No rows returned".
3. Repeat for each file **in order**:
   `…000200_profiles`, `…000300_catalog`, `…000400_notifications_audit`,
   `…000500_offers_orders`, `…000600_moderation_admin`, `…000700_payments`, `…000800_storage`.
4. If a file fails, stop and note the error — do not skip it.

**Option B — Supabase CLI (PowerShell)**

```powershell
npx supabase login
npx supabase init          # only if there is no supabase\config.toml yet; answer "N" to the prompts
npx supabase link --project-ref YOUR_PROJECT_REF   # the ref is in Project Settings → General
npx supabase db push
```

> The migrations were tested on PostgreSQL 16 with the Supabase Auth service and the
> Supabase role and schema layout reproduced locally (see `tests/stack`). They have not yet
> been applied to a hosted Supabase project by me — the first `db push` (or SQL-editor run)
> is that test. Report any error message exactly as shown.

## 3. Copy the API keys into the app

**Project Settings → API Keys** (older dashboards: **Project Settings → API**):

| Supabase shows | Put it in | Notes |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | e.g. `https://abcd.supabase.co` |
| Publishable key (`sb_publishable_…`) — or legacy **anon** key | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Safe in the browser; RLS protects data |
| Secret key (`sb_secret_…`) — or legacy **service_role** key | `SUPABASE_SECRET_KEY` | **Server only.** Bypasses all security rules. Never share it, never put it in a `NEXT_PUBLIC_` variable |

## 4. Authentication settings

**Authentication → URL Configuration**

* **Site URL:** your live address, e.g. `https://agrilink.in` (or the `*.vercel.app` URL
  until you have a domain).
* **Redirect URLs:** add
  * `https://YOUR-DOMAIN/auth/confirm`
  * `https://YOUR-DOMAIN/auth/callback`
  * `http://localhost:3000/**` (for local development)

**Authentication → Providers → Email**

* Email provider: **on**. **Confirm email: on** (recommended).
* Minimum password length: **8**.

**Authentication → Emails → Templates** — so email links work even when opened on a
different phone or browser, replace the link in two templates:

*Confirm signup*

```html
<h2>Confirm your AgriLink account</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard">Confirm my email</a></p>
```

*Reset password*

```html
<h2>Reset your AgriLink password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a></p>
<p>If you didn’t ask for this, ignore this email.</p>
```

(The default templates also work, but only when the link is opened in the same browser that
signed up.)

**Custom SMTP (before real launch).** Supabase's built-in email sender is limited to a few
emails per hour and is meant for testing. Under **Authentication → Emails → SMTP Settings**
connect a provider (for example Resend, Brevo, Amazon SES or Zoho) with an address on your
own domain.

**Rate limits** (Authentication → Rate Limits): defaults are fine for the pilot.

## 5. Make yourself an administrator

Admin rights are never granted by the app. After you register on the live site with your
own email:

**SQL Editor → New query**

```sql
insert into public.admins (user_id, note)
select id, 'Founder' from auth.users where email = 'you@example.com';
```

Sign out and back in; an **Admin** link appears in your account menu. To remove someone:
`delete from public.admins where user_id = (select id from auth.users where email = '…');`

## 6. Expire old offers automatically

Open offers stop counting as open after 7 days anyway (the app checks the date), but this job
also marks them expired in the database and notifies people. **Database → Extensions** →
enable **pg_cron**, then in the SQL editor:

```sql
select cron.schedule('agrilink-expire-offers', '*/15 * * * *', $$ select public.expire_stale_offers(); $$);
```

## 7. Storage

The `listing-images` (5 MB per file) and `avatars` (2 MB) buckets and their security
policies are created by the last migration. Nothing to do here. Photos are public to read
(they are shown on the marketplace); only the owning farmer can add or remove them.

## 8. Backups

The free plan keeps daily backups for a limited time. Before taking real orders, consider
the Pro plan (point-in-time recovery). **Database → Backups** shows what you have.

---

## Optional: a separate demo project

Use this if you want a public site full of sample farmers and listings to show people.

1. Create a second project, `agrilink-demo`, and run the same migrations (step 2).
2. Mark it as a demo database — **only in this project**:

   ```sql
   update public.app_config set demo_data_visible = true;
   ```

3. In PowerShell, from the project folder, point at the **demo** project and seed it:

   ```powershell
   $env:NEXT_PUBLIC_SUPABASE_URL = "https://YOUR-DEMO-REF.supabase.co"
   $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_…(demo project)"
   $env:SUPABASE_SECRET_KEY = "sb_secret_…(demo project)"
   $env:NEXT_PUBLIC_DEMO_MODE = "true"
   $env:DEMO_ACCOUNT_PASSWORD = "choose-a-long-password"
   npm run seed:demo -- --target-is-demo
   ```

   The script refuses to run unless the flag is given, demo mode is on **and** the database
   says `demo_data_visible = true` — so it cannot write into the production project. To
   start the demo over: `npm run seed:demo -- --target-is-demo --reset`.

4. Deploy a second Vercel project for the demo with `NEXT_PUBLIC_DEMO_MODE=true`, the demo
   project's keys and the same `DEMO_ACCOUNT_PASSWORD` (see `VERCEL_DEPLOY.md`). Its login
   page then shows **Demo farmer** / **Demo buyer** buttons.
