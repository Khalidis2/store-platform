# Store Platform — Phases 1–8

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
- `lib/orders.ts` (`applyRefund`) — shared logic used by both the admin
  action and the webhook, so refunds stay consistent regardless of where
  they're triggered from. Idempotent: refunding twice is a no-op
- `app/store/admin/orders/actions.ts` (`refundOrder`) — calls
  `stripe.refunds.create` with `reverse_transfer: true` and
  `refund_application_fee: true`, so a refund reverses **both** the payout
  to the merchant's connected account and the platform's own fee — without
  `refund_application_fee`, the platform would keep a fee on a cancelled order
- Restocking on refund is conditional: if the order hadn't shipped yet,
  inventory is restored; if it had already shipped, it isn't — the item has
  physically left, and handling actual returned goods is a manual process
  outside MVP scope
- `charge.refunded` webhook case catches refunds issued directly from the
  Stripe dashboard (not just ones triggered through our app), keeping order
  status correct either way
- `RefundButton.tsx` — confirm dialog before submitting, since this reverses
  real money movement
- New order status: `refunded` (alongside `pending`, `paid`, `shipped`, `expired`)

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
   signing secret it prints into `STRIPE_WEBHOOK_SECRET`
7. To test subdomain routing locally, add a hosts file entry, e.g.
   `127.0.0.1 teststore.localhost`, then visit
   `http://teststore.localhost:3000`

## Deploying

- Push to GitHub, import into Vercel
- Add a wildcard domain (`*.yourapp.com`) in Vercel's domain settings
- Set `DATABASE_URL`, the Supabase env vars, and `STRIPE_SECRET_KEY` in Vercel
- Add a Stripe webhook endpoint at `https://yourapp.com/api/webhooks/stripe`
  listening for `checkout.session.completed`, `checkout.session.expired`,
  `charge.refunded`, and `account.updated`; copy its signing secret into
  `STRIPE_WEBHOOK_SECRET` in Vercel
- Update `lib/subdomain.ts` (`ROOT_DOMAINS`) and `lib/cookie-domain.ts` with
  your real domain

## What's next (beyond MVP, in rough priority order)

- Periodic sweep for `pending` orders older than the session expiry window,
  as a backstop if a `checkout.session.expired` webhook is ever missed
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
