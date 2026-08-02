# Store Platform — Phases 1–11

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
- `app/store/admin/` — product CRUD, orders, settings

**Phase 3 — real storefront, cart, checkout**
- `app/store/(shop)/` — product grid, product detail, cart, checkout, order
  confirmation
- `lib/cart-context.tsx` — client-side cart in `localStorage`, scoped per store

**Phase 4 — Stripe Connect payments**
- `connectStripe` action — Custom account (UAE), hosted onboarding
- `app/store/api/checkout/pay/route.ts` — Checkout Session as a destination
  charge, platform fee via `PLATFORM_FEE_PERCENT`
- `app/api/webhooks/stripe/route.ts` — root-domain webhook

**Phase 5 — fulfillment loop (order status, initial inventory handling)**

**Phase 6 — shipping address + shipped status**
- Checkout collects a real shipping address; order flow `pending → paid → shipped`

**Phase 7 — proper inventory reservation**
- `lib/inventory.ts` — atomic reserve/release, race-safe under concurrent checkouts

**Phase 8 — refunds**
- `lib/orders.ts` (`applyRefund`) — reverses payout + platform fee via Stripe

**Phase 9 — stale reservation sweep**
- Vercel daily cron + optional GitHub Actions 15-minute workflow

**Phase 10 — partial refunds**
- Editable refund amount, `partially_refunded` status, `refunded_amount_cents`
  tracking. One refund per order (full or partial), no incremental multiples

**Phase 11 — delivered status, accurate net revenue**
- Order lifecycle now goes `pending → paid → shipped → delivered`.
  `markDelivered` (`app/store/admin/orders/actions.ts`) is a manual,
  merchant-marked transition — there's no carrier-tracking integration doing
  this automatically, which is a real gap if you want it eventually, but a
  whole separate integration project, not attempted here
- Refunds remain available for `paid` and `shipped` orders, but **not**
  `delivered` — once a merchant confirms delivery, further recourse is a
  proper returns process, explicitly out of scope
- **Revenue calculation fixed**: previously summed the full `total_cents` of
  every paid/shipped order, which overstated revenue on any partially
  refunded order. Now computes `total_cents - refunded_amount_cents` across
  all post-payment statuses (including fully `refunded`, which nets to zero
  automatically since `refunded_amount_cents` equals the total there) —
  dashboard now shows true net revenue, not gross

## Setup

1. `npm install`
2. Create a Supabase project (Postgres + Auth)
3. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL`, the two
   `NEXT_PUBLIC_SUPABASE_*` values, `STRIPE_SECRET_KEY`, and `CRON_SECRET`
4. Run `schema.sql` against the database (or run the migrations in
   `migrations/` in order, if upgrading an existing DB)
5. `npm run dev`
6. **Stripe webhook (local testing)**: install the Stripe CLI, run
   `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, put the
   signing secret it prints into `STRIPE_WEBHOOK_SECRET`
7. To test subdomain routing locally, add a hosts file entry, e.g.
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
- `vercel.json`'s cron entry deploys automatically with the project
- Update `lib/subdomain.ts` (`ROOT_DOMAINS`) and `lib/cookie-domain.ts` with
  your real domain

## What's next (beyond MVP, in rough priority order)

- Password reset flow
- Order search/filtering in admin
- Per-merchant platform fee tiers
- Address validation / structured country-state selects instead of free text
- Carrier tracking integration (auto-transition shipped → delivered)
- Incremental multiple partial refunds per order

## Deliberately cut from MVP

Custom domains, theme customization, apps marketplace, multi-currency,
discount codes, customer accounts (guest checkout via email only), handling
of actual returned physical goods after a post-shipment refund.
