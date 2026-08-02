# Store Platform — Phases 1–16

Multi-tenant e-commerce platform, MVP scope. Hand this repo to Claude Code to
keep building.

## What's here

**Phase 1 — tenancy foundation**

**Phase 2 — admin dashboard (Supabase Auth)**

**Phase 3 — real storefront, cart, checkout**

**Phase 4 — Stripe Connect payments**

**Phase 5 — fulfillment loop**

**Phase 6 — shipping address + shipped status**

**Phase 7 — proper inventory reservation**

**Phase 8 — refunds**

**Phase 9 — stale reservation sweep**

**Phase 10 — partial refunds (single)**

**Phase 11 — delivered status, net-of-refunds revenue**

**Phase 12 — password reset**

**Phase 13 — order search/filtering**

**Phase 14 — platform admin + per-merchant fee tiers**

**Phase 15 — structured country selection**

**Phase 16 — incremental (multiple) partial refunds**
- `refundOrder` now works off the **remaining refundable balance**
  (`total_cents - refunded_amount_cents`), not the original order total —
  an order can be refunded more than once, each time up to whatever's left
- Every refund call to Stripe now passes an **explicit `amount`**, even
  when refunding everything remaining. Previously the code omitted `amount`
  to mean "full refund," which is fine for a first refund but ambiguous to
  reason about once a prior partial refund already exists on the same
  charge — being explicit removes that ambiguity entirely
- **Bug fixed in the process**: restocking logic used to check
  `status === 'paid'` to infer "this order never shipped." That breaks once
  `status` has already moved to `partially_refunded` — a second refund on
  an already-partially-refunded, never-shipped order would have silently
  skipped restocking. Fixed with a dedicated `has_shipped` boolean
  (`migrations/007_...sql`), set independently by `markShipped` and checked
  by `applyRefund` regardless of how many refund states `status` has since
  passed through
- Restocking still only happens once — on whichever refund brings the order
  to fully `refunded` — not per-increment, since per-item refund allocation
  (which units a partial refund corresponds to) remains out of scope

## Setup

1. `npm install`
2. Create a Supabase project (Postgres + Auth)
3. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL`, the two
   `NEXT_PUBLIC_SUPABASE_*` values, `STRIPE_SECRET_KEY`, and `CRON_SECRET`
4. Run `schema.sql` against the database (or run the migrations in
   `migrations/` in order, if upgrading an existing DB)
5. In Supabase Auth → URL Configuration, add a wildcard redirect URL for
   your domain (needed for password reset across subdomains)
6. Sign up as a merchant for yourself, then grant yourself platform-admin
   access — see `migrations/006_phase14_platform_admin.sql`
7. `npm run dev`
8. **Stripe webhook (local testing)**: install the Stripe CLI, run
   `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, put the
   signing secret it prints into `STRIPE_WEBHOOK_SECRET`
9. To test subdomain routing locally, add a hosts file entry, e.g.
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
- Grant yourself platform-admin access via SQL
- `vercel.json`'s cron entry deploys automatically with the project
- Update `lib/subdomain.ts` (`ROOT_DOMAINS`) and `lib/cookie-domain.ts` with
  your real domain

## What's next (beyond MVP)

- Expand `lib/countries.ts` toward the full ISO list if global customers
  become a reality
- Carrier tracking integration (auto-transition shipped → delivered) —
  needs a decision on which carrier(s) to integrate first

## Deliberately cut from MVP

Custom domains, theme customization, apps marketplace, multi-currency,
discount codes, customer accounts (guest checkout via email only), handling
of actual returned physical goods after a post-shipment refund, per-item
refund allocation (and therefore per-item restocking on partial refunds).
