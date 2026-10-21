# AgriLink — Starting local. Scaling smart.

**Live Demo:** [https://agrilink-blue.vercel.app](https://agrilink-blue.vercel.app)

A pre-harvest marketplace for Patiala, Punjab. Farmers list tomatoes, potatoes and onions
before harvest. Retailers, restaurants, hotels and processors browse nearby growers, make
offers and agree terms early. Tagline: *Starting local. Scaling smart.*

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase
(Postgres, Auth, Storage) · Zod · Vercel.

| Document | What it covers |
|---|---|
| [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) | Creating the database, auth settings, email templates, making yourself admin, the optional demo project |
| [docs/VERCEL_DEPLOY.md](docs/VERCEL_DEPLOY.md) | Putting the site online |
| [docs/SECURITY.md](docs/SECURITY.md) | How the app is protected, and the launch checklist |
| [docs/PAYMENTS_PLAN.md](docs/PAYMENTS_PLAN.md) | What is prepared for Razorpay and what remains (payments are **off**) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the code is organised, for a developer |
| [docs/DESIGN_INVENTORY.md](docs/DESIGN_INVENTORY.md) | Design sources, colours, type and the page mapping |

---

## What the site does today

* **Public:** home page, Explore Produce (search, filters by crop / village / distance /
  price / quantity / harvest window / verified, sort, grid or list, pagination), listing
  pages with photo gallery and offer form, farmer profiles with ratings, About, Services,
  Contact, Privacy and Terms (drafts).
* **Accounts:** register as farmer or buyer, email confirmation, log in, forgot / reset
  password, sign out.
* **Farmers:** create, edit, publish, pause, archive or delete-draft listings; up to 6 photos
  (location data stripped); see and answer offers (accept, decline, counter); confirm orders
  with a date, mark preparing and ready.
* **Buyers:** save listings; make offers; answer counter-offers; follow orders; confirm
  receipt; rate the farmer.
* **Both:** phone numbers shared only after the farmer confirms an order; notifications with
  read / unread; report a listing or a person; profile page.
* **Admin:** overview counts, reports queue, hide / restore listings, suspend / restore
  accounts, verify farmers (with a note of how), cancel orders, audit log.
* **Preview mode:** with no database configured the site shows illustrative sample listings
  read-only, with a banner saying so.

### Not built yet / known limits

* **Online payments** — off by design; see `docs/PAYMENTS_PLAN.md`.
* **Mandi (APMC) reference prices** — the panel says "Not connected yet". Needs an
  AGMARKNET / data.gov.in data feed and a daily import job.
* **Phone OTP / document verification** — verification is a manual admin decision recorded
  with a note.
* **Logistics partners, FPO onboarding** — planned only.
* **Chat between buyer and farmer** — messages are attached to offers; there is no free chat.
* **Email / SMS / WhatsApp notifications** — notifications are in-app only (plus Supabase's
  own account emails).
* **Hindi / Punjabi** — English only so far.
* **Profile photos** — the storage bucket exists; the upload screen does not.
* **Account deletion** — by email request (documented in the privacy notice), not self-service.
* **Sign-in rate limiting** is per server instance; add a Vercel Firewall rule for launch.
* The migrations are tested on a local Supabase-compatible stack (PostgreSQL 16 + Supabase
  Auth + PostgREST + a storage emulator). They have **not yet been applied to a hosted
  Supabase project**; doing that is the first step in `docs/SUPABASE_SETUP.md`.

---

## Run it on your Windows computer

You need **Node.js 22 LTS** (<https://nodejs.org>) and **Git** (<https://git-scm.com>).
Open **PowerShell** in the project folder (in File Explorer: right-click the folder →
*Open in Terminal*).

```powershell
node --version          # should print v22.x
npm ci                  # installs exact dependency versions (first time: a few minutes)
Copy-Item .env.example .env.local
npm run dev             # then open http://localhost:3000
```

With `.env.local` left as copied, the site runs in **preview mode** (sample listings, no
accounts). To use real accounts, fill in the three Supabase values in `.env.local`
(see `docs/SUPABASE_SETUP.md`) and restart `npm run dev`:

```powershell
notepad .env.local
```

To check a production build locally:

```powershell
npm run build
npm run start
```

> If PowerShell says *"running scripts is disabled on this system"* when running `npm`,
> run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then try again.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local development server at http://localhost:3000 |
| `npm run build` / `npm run start` | Production build / run it |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (money, units, state machines, validation, redirects, webhook signatures) |
| `npm run test:db` | Database security and workflow tests (needs the local test stack) |
| `npm run test:e2e` | Browser tests: the full deal flow, moderation, accessibility, phone layout (needs the stack and a build) |
| `npm run seed:demo -- --target-is-demo` | Fill a **demo** Supabase project with sample data (refuses anywhere else) |

## Tests

| Suite | Count | What it proves |
|---|---|---|
| Unit (`tests/unit`) | 34 | Money maths in paise, unit conversion, offer/order/listing rules, form validation, URL filters, open-redirect protection, error messages, rate limiter, Razorpay signature check |
| Database (`tests/db`) | 48 | Row Level Security for every table and role, no unintended callable functions, concurrent acceptance cannot oversell, stale-version protection, order lifecycle, TypeScript ↔ SQL state-machine parity, payment idempotency, storage folder ownership |
| Browser (`tests/e2e`) | 26 | A complete deal through the real UI (register → list with photo, GPS stripped → offer → counter → accept → confirm → contacts shared → ready → complete → rating), notifications, reporting, admin hide/verify/audit, admin area hidden from others, axe accessibility on 19 pages, no sideways scrolling at 360 px, skip link |

The database and browser tests run against a **local Supabase-compatible stack**
(`tests/stack`), which needs Linux. On Windows use **WSL 2** (Ubuntu) — or simply push to
GitHub: `.github/workflows/ci.yml` runs every suite on GitHub's Linux machines.

In WSL / Linux (Ubuntu 24.04 with PostgreSQL 16: `sudo apt install postgresql`; when running as root also set `STACK_OS_USER=postgres`):

```bash
npm ci
npm run stack:download        # Supabase Auth + PostgREST binaries (once)
npm run stack:reset           # fresh database with all migrations
npm run stack:start &         # keep running in the background
npm run test:db
eval "$(npm run --silent stack:env | sed 's/^/export /')"
NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build
npx playwright install chromium   # once
npm run test:e2e
```

## Put the code on GitHub

```powershell
git init
git add .
git status            # check: no .env.local in the list
git commit -m "AgriLink"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/agrilink.git   # create an EMPTY private repo first
git push -u origin main
```

`.gitignore` already excludes `.env*` files (except `.env.example`), `node_modules`, build
output and test output.

## Rules this codebase keeps

* Secrets stay server-side; nothing secret uses a `NEXT_PUBLIC_` name.
* No verification badge without a real admin verification record; demo verification is
  labelled "Verified · demo".
* No invented prices, partnerships, users or transactions. Sample data is always labelled.
* A browser callback is never proof of payment.
