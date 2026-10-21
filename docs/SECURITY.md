# Security

## How the app is protected

| Area | What is in place | Where |
|---|---|---|
| Authorisation | Row Level Security on every table; column-level grants; all state changes through SQL functions that re-check the caller | `supabase/migrations` |
| Function exposure | EXECUTE revoked from `public, anon, authenticated` on every function, then granted explicitly; a test fails if anything else becomes callable | `tests/db/privileges.test.ts` |
| Roles | Account type limited to farmer/buyer at sign-up (by the database trigger, not the form); admin only via the `admins` table, set in SQL by the owner | `20261021000200_profiles.sql`, `…000100_foundation.sql` |
| Sessions | Supabase Auth cookies (HTTP-only), refreshed in `proxy.ts`; server code validates the JWT with `getClaims()` | `src/proxy.ts`, `src/server/auth.ts` |
| Protected pages | Proxy redirect **plus** a server-side check on every page and action; admin pages return 404 to non-admins | `src/server/auth.ts` |
| Input | Zod validation in every Server Action; the same limits as database CHECK constraints | `src/domain/validation.ts` |
| Concurrency | Row locks + expected-version checks on offers; quantity reserved atomically | `accept_offer` |
| Abuse limits | DB limits: 30 listings/day, 20 offers/hour, 10 reports/hour, 10 counter-offers per offer. Per-IP limits on sign-in, sign-up, password reset and demo sign-in (best effort, per server instance) | migrations, `src/lib/rate-limit.ts` |
| Privacy | Phone and email only to the counterparty of a confirmed order; no farm addresses; reporter identity never shown to the reported person; admin user list omits phone numbers | `get_order_contacts`, `profile_contacts` |
| Uploads | Type checked by magic bytes, size limits, re-encoded to WebP by sharp (strips EXIF/GPS), stored under the owner's folder, storage policies enforce ownership | `src/server/images.ts`, `…000800_storage.sql` |
| Redirects | `next` parameters accept only same-site paths (blocks `//evil.com`, `/\evil.com`, tab/newline tricks) | `safeNextPath` in `src/lib/utils.ts` |
| CSRF | Server Actions check the Origin header (Next.js); the sign-out route handler checks it too and is POST-only | `src/app/auth/signout/route.ts` |
| Headers | Content-Security-Policy, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy | `next.config.ts` |
| Secrets | Only `NEXT_PUBLIC_*` values reach the browser; the secret key is imported only by `server-only` modules (the build fails if a client component imports them) | `src/server/env.ts`, `src/lib/supabase/service.ts` |
| Payments | Not active. When enabled: only HMAC-verified webhooks change payment status, idempotent per event id, amount mismatches flagged; the browser callback is never trusted | `docs/PAYMENTS_PLAN.md` |
| Demo isolation | Demo rows are `is_demo` and visible only where `app_config.demo_data_visible` is true (demo project only). Demo mode never bypasses authorisation; demo sign-in is a real password sign-in | migrations, `scripts/seed-demo.ts` |
| Audit | Admin actions, admin order cancellations and payment events are written to `audit_events`, readable only by admins, not editable through the API | `…000400_notifications_audit.sql` |

## Launch checklist

- [ ] `.env.local` and any file with keys are **not** in Git (`git status` shows them as ignored).
- [ ] `SUPABASE_SECRET_KEY` exists only in Vercel's environment variables and your password manager.
- [ ] Production Vercel project has `NEXT_PUBLIC_DEMO_MODE=false` and **no** `DEMO_ACCOUNT_PASSWORD`.
- [ ] Production database: `select demo_data_visible from public.app_config;` returns `false`.
- [ ] Production database has no demo rows: `select count(*) from public.profiles where is_demo;` returns `0`.
- [ ] Supabase **Confirm email** is on; Site URL and Redirect URLs point at your real domain.
- [ ] Custom SMTP configured (the built-in sender is for testing only).
- [ ] Only the people who need it are in `public.admins`.
- [ ] Supabase → **Advisors → Security Advisor** shows no errors.
- [ ] Vercel Firewall rate-limit rule on `POST /login` and `/register` (recommended).
- [ ] Privacy notice and terms reviewed by a lawyer (current texts are marked as drafts).
- [ ] Turn on 2-factor authentication for your GitHub, Vercel and Supabase accounts.

## Manual checks to do before launch

Automated accessibility tests (axe) cover only part of WCAG. Before launch, also try:
the whole deal flow using only the keyboard; a screen reader (NVDA on Windows, TalkBack on
Android) on the listing and offer pages; the site at 200 % zoom; and an Android phone on a
slow connection.

## Reporting a vulnerability

Email mahawar.manas@gmail.com. Please do not test against other people's accounts.
