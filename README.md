# Store Platform — Phases 1–9

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
- Checkout collects a real shipping address, stored as `orders.shipping_address`
- Order status flow: `pending → paid → shipped`, with `tracking_number`

**Phase 7 — proper inventory reservation**
- `lib/inventory.ts` — atomic reserve/release, race-safe under concurrent
  checkouts. Reservation happens when a Checkout Session is created, released
  automatically if the session expires unpaid (`checkout.session.expired`)

**Phase 8 — refunds**
- `lib/orders.ts` (`applyRefund`) — reverses both the merchant payout and the
  platform fee via Stripe, conditionally restocks (only if not yet shipped),
  idempotent, catches refunds issued from the Stripe dashboard too

**Phase 9 — stale reservation sweep**
- `lib/orders.ts` (`releaseStaleReservations`) — backstop for the rare case
  where a `checkout.session.expired` webhook is never delivered. Finds
  `pending` orders with reserved stock older than 45 minutes (comfortably
  past the 31-minute session expiry) and releases them
- `app/api/cron/release-stale-reservations/route.ts` — the endpoint,
  protected by a `CRON_SECRET` bearer token
- `vercel.json` — a daily Vercel Cron entry. **Vercel's Hobby plan only
  allows cron jobs to run once per day** — this is a weak backstop on its
  own given the 45-minute staleness window, but works without a paid plan
- `.github/workflows/release-stale-reservations.yml` — a GitHub Actions
  workflow running every 15 minutes for real coverage, same pattern as your
  existing news bot. Needs two things set in the GitHub repo: a `CRON_SECRET`
  **secret** (same value as in Vercel) and an `APP_DOMAIN` **variable** (e.g.
  `yourapp.com`) — Settings → Secrets and variables → Actions
- Either scheduler, or both together, works — they call the same endpoint

## Setup

1. `npm install`
2. Create a Supabase project (Postgres + Auth)
3. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL`, the two
   `NEXT_PUBLIC_SUPABASE_*` values, `STRIPE_SECRET_KEY`, and `CRON_SECRET`
   (generate with `openssl rand -hex 32`)
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
- If using the GitHub Actions sweep too, set the `CRON_SECRET` secret and
  `APP_DOMAIN` variable in the GitHub repo (see Phase 9 above)
- Update `lib/subdomain.ts` (`ROOT_DOMAINS`) and `lib/cookie-domain.ts` with
  your real domain

## What's next (beyond MVP, in rough priority order)

- Partial refunds (currently full-refund only)
- Order status beyond shipped (delivered, cancelled pre-shipment by merchant)
- Password reset flow
- Order search/filtering in admin
- Per-merchant platform fee tiers
- Address validation / structured country-state selects instead of free text

## Deliberately cut from MVP

Custom domains, theme customization, apps marketplace, multi-currency,
discount codes, customer accounts (guest checkout via email only), handling
of actual returned physical goods after a post-shipment refund.
