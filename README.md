# Store Platform — Phases 1–7

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
- `app/store/admin/orders/` shows line items per order

**Phase 6 — shipping address + shipped status**
- Checkout collects a real shipping address, stored as `orders.shipping_address`
- Order status flow: `pending → paid → shipped`, with `tracking_number`

**Phase 7 — proper inventory reservation (closes the oversell gap)**
- `lib/inventory.ts` — `reserveInventory` / `releaseInventory`, atomic via a
  single `UPDATE ... WHERE inventory >= $quantity` per line item, so two
  concurrent requests for the last unit of a product can't both succeed
- Reservation now happens in `app/store/api/checkout/pay/route.ts`, at the
  moment a Stripe Checkout Session is created — not on payment confirmation.
  The order row is locked (`FOR UPDATE`) for the duration, so a double-click
  on "Continue to payment" can't reserve stock twice
- Checkout Sessions now expire in 31 minutes (Stripe's minimum is 30). The
  webhook's new `checkout.session.expired` case releases the reservation and
  marks the order `expired` if it was never paid
- If Stripe's session-creation API call itself fails after stock was already
  reserved, the route releases it immediately in the same request — it
  doesn't rely solely on the expiry webhook for that specific failure mode
- Order status set now includes `expired` alongside `pending` / `paid` / `shipped`

**Known remaining gap**: this relies on Stripe reliably delivering the
`checkout.session.expired` webhook. If that delivery is ever missed (rare,
but Stripe doesn't guarantee zero failure), a reservation could stay locked
until manually investigated. A periodic sweep job that releases reservations
on `pending` orders older than the session expiry window would close this
fully — not built here, flagged as the one remaining edge case.

## Setup

1. `npm install`
2. Create a Supabase project (Postgres + Auth)
3. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL`, the two
   `NEXT_PUBLIC_SUPABASE_*` values, and `STRIPE_SECRET_KEY`
4. Run `schema.sql` against the database (or run the migrations in
   `migrations/` in order, if upgrading an existing DB)
5. `npm run dev`
6. **Stripe webhook (local testing)**: install the Stripe CLI, run
   `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, put the
   signing secret it prints into `STRIPE_WEBHOOK_SECRET`. Make sure
   `checkout.session.expired` is included in the events you're listening for
   (the CLI forwards all events by default; in the Dashboard you'll need to
   add it explicitly to the webhook endpoint's event list)
7. To test subdomain routing locally, add a hosts file entry, e.g.
   `127.0.0.1 teststore.localhost`, then visit
   `http://teststore.localhost:3000`

## Deploying

- Push to GitHub, import into Vercel
- Add a wildcard domain (`*.yourapp.com`) in Vercel's domain settings
- Set `DATABASE_URL`, the Supabase env vars, and `STRIPE_SECRET_KEY` in Vercel
- Add a Stripe webhook endpoint at `https://yourapp.com/api/webhooks/stripe`
  listening for `checkout.session.completed`, `checkout.session.expired`,
  and `account.updated`; copy its signing secret into `STRIPE_WEBHOOK_SECRET`
  in Vercel
- Update `lib/subdomain.ts` (`ROOT_DOMAINS`) and `lib/cookie-domain.ts` with
  your real domain

## What's next (beyond MVP, in rough priority order)

- Periodic sweep for `pending` orders older than the session expiry window,
  as a backstop if a `checkout.session.expired` webhook is ever missed
- Refunds/disputes handling
- Order status beyond shipped (delivered, cancelled)
- Password reset flow
- Order search/filtering in admin
- Per-merchant platform fee tiers
- Address validation / structured country-state selects instead of free text

## Deliberately cut from MVP

Custom domains, theme customization, apps marketplace, multi-currency,
discount codes, customer accounts (guest checkout via email only).
