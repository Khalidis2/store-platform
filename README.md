# Store Platform — Phases 1–13

Multi-tenant e-commerce platform, MVP scope. Hand this repo to Claude Code to
keep building.

## What's here

**Phase 1 — tenancy foundation**
- `schema.sql` — stores / products / orders, all tenant-scoped via `store_id`
- `middleware.ts` — resolves `{subdomain}.yourapp.com`, covers API routes too
- `lib/get-store.ts` — the tenant-resolution boundary

**Phase 2 — admin dashboard (Supabase Auth)**

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

**Phase 13 — order search/filtering**
- `app/store/admin/orders/page.tsx` now reads `searchParams` (`status`,
  `email`) and builds the WHERE clause dynamically. Server-rendered plain
  GET form — no client JS, consistent with the rest of the admin — so
  filters are shareable/bookmarkable URLs like `/admin/orders?status=paid`

## Setup

1. `npm install`
2. Create a Supabase project (Postgres + Auth)
3. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL`, the two
   `NEXT_PUBLIC_SUPABASE_*` values, `STRIPE_SECRET_KEY`, and `CRON_SECRET`
4. Run `schema.sql` against the database (or run the migrations in
   `migrations/` in order, if upgrading an existing DB)
5. In Supabase Auth → URL Configuration, add a wildcard redirect URL for
   your domain (needed for password reset across subdomains)
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
- In Supabase, add the wildcard redirect URL for password reset
- `vercel.json`'s cron entry deploys automatically with the project
- Update `lib/subdomain.ts` (`ROOT_DOMAINS`) and `lib/cookie-domain.ts` with
  your real domain

## What's next (beyond MVP, in rough priority order)

- Per-merchant platform fee tiers
- Address validation / structured country-state selects instead of free text
- Carrier tracking integration (auto-transition shipped → delivered)
- Incremental multiple partial refunds per order

## Deliberately cut from MVP

Custom domains, theme customization, apps marketplace, multi-currency,
discount codes, customer accounts (guest checkout via email only), handling
of actual returned physical goods after a post-shipment refund.
