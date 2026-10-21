# Deploying to Vercel

1. Put the code in a **private** GitHub repository (see README → "Put the code on GitHub").
2. At <https://vercel.com/new>, import that repository. Framework: **Next.js** (detected
   automatically). Leave the build settings as they are.
3. Before the first deploy, open **Environment Variables** and add, for **Production** (and
   **Preview** if you use preview deployments):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase (production project) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | from Supabase |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain` (no trailing slash) |
   | `NEXT_PUBLIC_DEMO_MODE` | `false` |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | `mahawar.manas@gmail.com` |
   | `SUPABASE_SECRET_KEY` | optional now; needed only when payments are switched on |

   Do **not** set `DEMO_ACCOUNT_PASSWORD` on the production project.

4. **Deploy.** Variables starting with `NEXT_PUBLIC_` are built into the site, so after
   changing any of them use **Deployments → … → Redeploy**.
5. **Region:** Project → Settings → Functions → Function Region → **Mumbai (bom1)**, close to
   the Supabase project.
6. **Domain:** Project → Settings → Domains → add your domain and follow the DNS steps.
   Then update `NEXT_PUBLIC_SITE_URL` and the Supabase **Site URL / Redirect URLs** to match,
   and redeploy.

## Check after deploying

* Home and Explore Produce load; the yellow "Preview mode" banner is **gone** (if you still
  see it, the Supabase variables were not set for this deployment — redeploy).
* Register with a new email, confirm it from the email, log in, create a listing.
* Sign up a second (buyer) account in a private window and make an offer.

## Demo deployment (optional)

Create a **second** Vercel project from the same repository with the **demo** Supabase
project's keys, `NEXT_PUBLIC_DEMO_MODE=true` and `DEMO_ACCOUNT_PASSWORD` set to the password
you used for `npm run seed:demo`. Demo deployments are never indexed by search engines.

## Limits to know

* Server actions accept up to 4 MB per request (Vercel's limit is 4.5 MB). Photos are shrunk
  in the browser before upload, so phone photos fit.
* The sign-in rate limiter is per server instance (best effort). For a public launch, add a
  Vercel Firewall rate-limit rule for `POST` requests to `/login` and `/register`.
