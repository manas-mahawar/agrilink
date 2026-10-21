# Architecture

AgriLink is one Next.js 16 application (App Router, React 19, TypeScript strict) backed by
Supabase (Postgres, Auth, Storage). It is deployed on Vercel. There is no separate API
server: pages and Server Actions talk to Supabase directly, and **the database is the
authority on every rule** — who can see what, which state changes are allowed, and how
quantities are reserved.

```
Browser ──► Next.js on Vercel ──────────────► Supabase
            • pages (server-rendered)         • Postgres + Row Level Security
            • Server Actions (writes)          • SQL functions for every state change
            • proxy.ts (session refresh)       • Auth (email + password)
            • /auth/* route handlers           • Storage (listing photos)
            • /api/payments/... (inactive)
```

## Folders

| Path | What lives there |
|---|---|
| `src/app/(site)` | Public pages: home, marketplace, listing, farmer profile, about, services, contact, privacy, terms |
| `src/app/(auth)` | Log in, register, forgot / reset password |
| `src/app/auth/*` | Email-link landing (`/auth/confirm`, `/auth/callback`) and sign-out (`POST /auth/signout`) |
| `src/app/dashboard` | Signed-in area for farmers and buyers |
| `src/app/admin` | Administrator area (404 for everyone else) |
| `src/app/api/payments/razorpay/webhook` | Payment webhook receiver — **inactive** until enabled |
| `src/domain` | Pure TypeScript rules shared by forms and server: money, units, offer/order state machines, validation (Zod) |
| `src/server` | Server-only code: auth helpers (`auth.ts`), data access (`data/`), Server Actions (`actions/`), image processing, payments |
| `src/components` | UI: `ui/` primitives, `site/` header/footer, `marketplace/`, `dashboard/`, `admin/` |
| `src/content` | Bundled photos, reference lists (categories, localities) and the illustrative demo catalogue |
| `supabase/migrations` | The whole database: tables, RLS policies, functions, storage buckets |
| `scripts/seed-demo.ts` | Seeds the demo catalogue into a **demo** project only |
| `tests/` | `unit/` (Vitest), `db/` (RLS + workflow tests against Postgres), `e2e/` (Playwright), `stack/` (local Supabase-compatible test stack) |

## Data and rules

* **Money** is integer paise everywhere (`bigint` in SQL, integers in TypeScript). Totals use
  integer maths. Quantities are `numeric(12,2)` with an explicit unit (kg, quintal, tonne).
* **Row Level Security is on for every table.** Table privileges are revoked from the API
  roles and granted per column, so even a forged request cannot set protected fields
  (`verified_at`, `is_demo`, `quantity_reserved`, `payment_status`, …).
* **State changes go through SQL functions**, not table updates: `create_offer`,
  `counter_offer`, `accept_offer`, `reject_offer`, `withdraw_offer`, `transition_order`,
  `review_order`, the `admin_*` functions and `apply_payment_event`. Each checks the caller,
  the current state and an expected version number, writes a history row and notifications.
  Every function's EXECUTE permission is revoked from `public, anon, authenticated` and
  granted explicitly; a test fails if any new function is callable by mistake.
* **No overselling.** `accept_offer` locks the listing row (`SELECT … FOR UPDATE`), checks the
  quantity still available, reserves it, and marks the listing sold out when nothing is left.
  A test fires two acceptances at the same time and checks only one succeeds.
* **Offers** alternate turns (pending → farmer's move, countered → buyer's move), carry a
  version number so stale screens can't act on changed terms, expire after 7 days, and allow
  at most 10 counter-offers. **Orders**: awaiting confirmation → confirmed (date set) →
  preparing → ready → completed, or cancelled with a reason. The TypeScript copies of these
  machines in `src/domain` only decide which buttons to show; a DB test checks they match the
  SQL exactly.
* **Privacy.** Phone numbers live in `profile_contacts` (owner-only) and are released only to
  the other party of a confirmed order via `get_order_contacts`. Public pages show village /
  town and an approximate distance, never a farm address. Uploaded photos are re-encoded with
  sharp, which removes EXIF/GPS metadata.
* **Demo data** rows carry `is_demo = true` and are only visible when the database's
  `app_config.demo_data_visible` is true — which is set only in the separate demo project.

## Rendering and caching

* Classic caching model (Cache Components off). Public catalogue pages read through an
  anonymous, cookie-less Supabase client, so they show exactly what a logged-out visitor may
  see and can be cached: home revalidates every 5 min, listing pages every 2 min, farmer
  pages every 5 min. Writes call `revalidatePath` so changes appear immediately.
* Signed-in pages (`/dashboard`, `/admin`) render per request with the user's session; the
  header, save buttons and offer panel are small client islands that read the session in
  the browser, so public pages stay cacheable.
* `src/proxy.ts` (Next 16's replacement for middleware) refreshes the session cookie and
  redirects signed-out visitors away from `/dashboard` and `/admin`. It is a convenience
  only: every protected page and action re-checks the user in `src/server/auth.ts`, and RLS
  applies regardless.

## Without a database: preview mode

When `NEXT_PUBLIC_SUPABASE_URL` is empty the site runs as a read-only **preview** using the
illustrative catalogue in `src/content/demo-catalog.ts`. Accounts are disabled, a banner
says so, and nothing can be written. This lets the site be looked at before Supabase is set up.

## Environments

| Environment | Supabase project | `NEXT_PUBLIC_DEMO_MODE` | `demo_data_visible` |
|---|---|---|---|
| Production | `agrilink-prod` | `false` | `false` |
| Demo (optional) | `agrilink-demo` (separate) | `true` | `true` |
| Local tests | local stack (`tests/stack`) | `false` | reset per test |

Demo mode only changes labels and shows demo sign-in buttons; it never bypasses authorisation.
Demo sign-in is a normal password sign-in to a seeded demo account.
