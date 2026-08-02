# Store Platform — Phases 1–12

Multi-tenant e-commerce platform, MVP scope. Hand this repo to Claude Code to
keep building.

## What's here

**Phase 1 — tenancy foundation**
- `schema.sql` — stores / products / orders, all tenant-scoped via `store_id`
- `middleware.ts` — resolves `{subdomain}.yourapp.com`, covers API routes too
- `lib/get-store.ts` — the tenant-resolution boundary

**Phase 2 — admin dashboard (Supabase Auth)**
- `app/signup/page.tsx`, `app/store/login/page.tsx` — account + store
  creation, login

**Phase 3 — real storefront, cart, checkout**

**Phase 4 — Stripe Connect payments**

**Phase 5 — fulfillment loop**

**Phase 6 — shipping address + shipped status**

**Phase 7 — proper inventory reservation**

**Phase 8 — refunds**

**Phase 9 — stale reservation sweep**

**Phase 10 — partial refunds**

**Phase 11 — delivered status, net-of-refunds revenue**

**Phase 12 — password reset**
- `app/store/forgot-password/page.tsx` — requests a reset link via Supabase
  Auth, redirecting back to the store's **own subdomain** (not a generic
  root URL — login only makes sense in the context of a specific store)
- `app/store/reset-password/page.tsx` — the browser client auto-detects the
  recovery token from the email link's URL fragment and establishes a
  session, so setting the new password is a plain `updateUser()` call
- **Deployment gotcha**: Supabase requires redirect URLs to be explicitly
  allow-listed per project (Authentication → URL Configuration). Since every
  merchant has a different subdomain, you need a **wildcard** entry there —
  something like `https://*.yourapp.com/reset-password` — or reset links
  will fail for every subdomain except whichever one you happened to test
  with first

## Setup

1. `npm install`
2. Create a Supabase project (Postgres + Auth)
3. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL`, the two
   `NEXT_PUBLIC_SUPABASE_*` values, `STRIPE_SECRET_KEY`, and `CRON_SECRET`
4. Run `schema.sql` against the database (or run the migrations in
   `migrations/` in order, if upgrading an existing DB)
5. In Supabase Auth → URL Configuration, add a wildcard redirect URL for
   your domain (see Phase 12 above) — needed for password reset to work
   across subdomains
6. `npm run dev`
7. **Stripe webhook (local testing)**: install the Stripe CLI, run
   `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, put the
   signing secret it prints into `STRIPE_WEBHOOK_SECRET`
8. To test subdomain routing locally, add a hosts file entry, e.g.
   `127.0.0.1 teststore.localhost`, then visit
   `http://teststore.localhost:3000`

## Deploying

- Push to GitHub, import into Vercel
- Add a wildcard domain (`*.yourapp.com`) in Vercel's domain settings
- Set `DATABASE_URL`, the Supabase env vars, `STRIPE_SECRET_KEY`, and
  `CRON_SECRET` in Vercel
- Add a Stripe webhook endpoint at `https://yourapp.com/api/webhooks/stripe`
  listening for `checkout.session.completed`, `checkout.session.expired`,
  `charge.refunded`, and `account.updated`; copy its signing secret into
  `STRIPE_WEBHOOK_SECRET` in Vercel
- In Supabase, add the wildcard redirect URL for password reset (Phase 12)
- `vercel.json`'s cron entry deploys automatically with the project
- Update `lib/subdomain.ts` (`ROOT_DOMAINS`) and `lib/cookie-domain.ts` with
  your real domain

## What's next (beyond MVP, in rough priority order)

- Order search/filtering in admin
- Per-merchant platform fee tiers
- Address validation / structured country-state selects instead of free text
- Carrier tracking integration (auto-transition shipped → delivered)
- Incremental multiple partial refunds per order

## Deliberately cut from MVP

Custom domains, theme customization, apps marketplace, multi-currency,
discount codes, customer accounts (guest checkout via email only), handling
of actual returned physical goods after a post-shipment refund.
