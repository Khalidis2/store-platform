# Store Platform — Phases 1–5 (MVP loop complete)

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

**Phase 5 — fulfillment loop**
- The webhook now decrements inventory when an order is marked paid,
  wrapped in a transaction and gated on `status = 'pending' → 'paid'` in the
  same query — safe against Stripe redelivering the same event twice
- `app/store/api/checkout/route.ts` checks requested quantity against
  current stock before creating an order (doesn't fully prevent overselling
  under concurrent checkouts — that needs proper inventory reservation,
  deliberately left out of MVP)
- `app/store/admin/orders/` now shows line items per order and a "Mark
  fulfilled" action for paid orders (`app/store/admin/orders/actions.ts`)
- Admin dashboard shows a "Needs fulfillment" count — the actionable signal
  a merchant checks day to day

This closes the full loop: browse → cart → checkout → pay → merchant gets
paid minus platform fee → inventory updates → merchant fulfills.

## Setup

1. `npm install`
2. Create a Supabase project (Postgres + Auth)
3. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL`, the two
   `NEXT_PUBLIC_SUPABASE_*` values, and `STRIPE_SECRET_KEY`
4. Run `schema.sql` against the database (or the migration in `migrations/`
   if upgrading an existing DB)
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
- Set `DATABASE_URL`, the Supabase env vars, and `STRIPE_SECRET_KEY` in Vercel
- Add a Stripe webhook endpoint at `https://yourapp.com/api/webhooks/stripe`
  listening for `checkout.session.completed` and `account.updated`; copy its
  signing secret into `STRIPE_WEBHOOK_SECRET` in Vercel
- Update `lib/subdomain.ts` (`ROOT_DOMAINS`) and `lib/cookie-domain.ts` with
  your real domain

## What's next (beyond MVP, in rough priority order)

- Proper inventory reservation to fully close the oversell gap
- Order status beyond fulfilled (shipped, cancelled, refunded)
- Refunds/disputes handling
- Shipping address collection
- Password reset flow
- Order search/filtering in admin
- Per-merchant platform fee tiers

## Deliberately cut from MVP

Custom domains, theme customization, apps marketplace, multi-currency,
discount codes, customer accounts (guest checkout via email only).
