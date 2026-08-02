# Store Platform — Phases 1–4

Multi-tenant e-commerce platform, MVP scope. Hand this repo to Claude Code to
keep building.

## What's here

**Phase 1 — tenancy foundation**
- `schema.sql` — stores / products / orders, all tenant-scoped via `store_id`
- `middleware.ts` — resolves `{subdomain}.yourapp.com` and rewrites to `/store/*`
  (covers API routes too)
- `lib/get-store.ts` — the tenant-resolution boundary

**Phase 2 — admin dashboard (Supabase Auth)**
- `app/signup/page.tsx`, `app/store/login/page.tsx` — merchant account +
  store creation, login
- `app/store/admin/` — product CRUD, read-only order list, settings

**Phase 3 — real storefront, cart, checkout**
- `app/store/(shop)/` — product grid, product detail, cart, checkout, order
  confirmation
- `lib/cart-context.tsx` — client-side cart in `localStorage`, scoped per store

**Phase 4 — Stripe Connect payments**
- `app/store/admin/settings/actions.ts` (`connectStripe`) — creates a Stripe
  Custom account (country `AE`) for the store and sends the merchant to
  Stripe's hosted onboarding. Business type is left for Stripe's form to
  collect, along with the UAE trade license — required for Custom accounts
  in this configuration, individuals without one can't complete onboarding
- `app/store/api/checkout/pay/route.ts` — creates a Stripe Checkout Session
  as a destination charge: payment goes to the merchant's connected account,
  minus a platform fee (`PLATFORM_FEE_PERCENT`, currently 5%, adjust as needed)
- `app/api/webhooks/stripe/route.ts` — root-domain webhook (Stripe hits one
  global endpoint, not per-subdomain). Handles `account.updated` (flips
  `store.is_live` once onboarding is verified) and `checkout.session.completed`
  (marks the order `paid`)
- Checkout now blocks entirely with a clear message if `store.is_live` is
  false, instead of accepting orders a store can't actually fulfill

## Setup

1. `npm install`
2. Create a Supabase project (Postgres + Auth)
3. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL`, the two
   `NEXT_PUBLIC_SUPABASE_*` values, and `STRIPE_SECRET_KEY`
4. Run `schema.sql` against the database (or the migration in `migrations/`
   if upgrading an existing DB)
5. `npm run dev`
6. **Stripe webhook (local testing)**: install the Stripe CLI, run
   `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, and put
   the webhook signing secret it prints into `STRIPE_WEBHOOK_SECRET`
7. To test subdomain routing locally, add a hosts file entry, e.g.
   `127.0.0.1 teststore.localhost`, then visit
   `http://teststore.localhost:3000`

## Deploying

- Push to GitHub, import into Vercel
- Add a wildcard domain (`*.yourapp.com`) in Vercel's domain settings
- Set `DATABASE_URL`, the Supabase env vars, and `STRIPE_SECRET_KEY` in Vercel
- In the Stripe Dashboard, add a webhook endpoint pointing at
  `https://yourapp.com/api/webhooks/stripe`, listening for
  `checkout.session.completed` and `account.updated` — copy its signing
  secret into `STRIPE_WEBHOOK_SECRET` in Vercel
- Update `lib/subdomain.ts` (`ROOT_DOMAINS`) and `lib/cookie-domain.ts`
  with your real domain

## Not built yet (in order)

- **Phase 5** — Order fulfillment loop: inventory decrement on confirmed
  payment, merchant-facing order status updates (shipped/fulfilled)

## Deliberately cut from MVP

Custom domains, theme customization, apps marketplace, multi-currency,
discount codes, customer accounts (guest checkout via email only), password
reset, shipping address collection, order search/filtering in admin,
refunds/disputes handling, platform fee configurability per merchant tier.
