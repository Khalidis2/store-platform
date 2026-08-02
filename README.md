# Store Platform — Phases 1–17

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

**Phase 17 — carrier tracking (Aramex + Emirates Post)**
- **Why AfterShip and not each carrier's own API**: Aramex has a real
  tracking API, but it's SOAP/XML, requires a registered Aramex business
  account, and its request/response schema is involved enough that getting
  it right without a real account to test against is risky. Emirates Post
  doesn't have a documented public API at all — direct integration would
  need a business contract with them. AfterShip is a tracking aggregator
  that supports both carriers through one consistent REST/JSON API and
  webhook, which is genuinely how most e-commerce platforms handle this —
  not a corner cut, the standard approach given how fragmented carrier APIs
  actually are
- `lib/aftership.ts` — registers a tracking number with AfterShip when a
  merchant marks an order shipped and selects Aramex or Emirates Post as the
  carrier. Fails soft (logs, doesn't throw) if AfterShip isn't configured or
  the API call fails — a merchant marking something shipped should never be
  blocked by a tracking-registration hiccup
- `app/api/webhooks/aftership/route.ts` — AfterShip pushes status updates
  here; when a tracking's `tag` becomes `Delivered`, the matching order
  auto-transitions to `delivered` via the shared `markOrderDelivered()` in
  `lib/orders.ts` (same function the manual "Mark delivered" button uses)
- HMAC signature verification via `AFTERSHIP_WEBHOOK_SECRET` — **skipped
  entirely if that env var isn't set**, which is fine for initial local
  testing but means the endpoint accepts unverified requests until it's
  configured. Set it before relying on this in production
- **Uncertain payload shape, handled defensively**: AfterShip's webhook body
  structure has varied by API version historically (sometimes wrapped in a
  `msg` field). The webhook handler checks multiple possible shapes rather
  than assuming one — if delivery detection doesn't work after setup, log
  the raw payload once to see which shape you're actually receiving and
  adjust
- Orders with `carrier = "other"` (or no carrier selected) just store the
  tracking number as free text, same as before Phase 17 — no automated
  delivery detection for carriers outside Aramex/Emirates Post
- Requires an AfterShip account (free tier available) — `AFTERSHIP_API_KEY`
  and `AFTERSHIP_WEBHOOK_SECRET` in your env

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
7. (Optional) Sign up for AfterShip, get an API key, and configure a
   webhook pointing at `/api/webhooks/aftership` for automated carrier
   tracking — otherwise tracking numbers are just stored as free text
8. `npm run dev`
9. **Stripe webhook (local testing)**: install the Stripe CLI, run
   `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, put the
   signing secret it prints into `STRIPE_WEBHOOK_SECRET`
10. To test subdomain routing locally, add a hosts file entry, e.g.
    `127.0.0.1 teststore.localhost`, then visit
    `http://teststore.localhost:3000`

## Deploying

- Push to GitHub, import into Vercel
- Add a wildcard domain (`*.yourapp.com`) in Vercel's domain settings
- Set `DATABASE_URL`, the Supabase env vars, `STRIPE_SECRET_KEY`,
  `CRON_SECRET`, and (if using carrier tracking) the AfterShip env vars in
  Vercel
- Add a Stripe webhook endpoint at `https://yourapp.com/api/webhooks/stripe`
  listening for `checkout.session.completed`, `checkout.session.expired`,
  `charge.refunded`, and `account.updated`; copy its signing secret into
  `STRIPE_WEBHOOK_SECRET` in Vercel
- If using AfterShip, add a webhook pointing at
  `https://yourapp.com/api/webhooks/aftership` in AfterShip's dashboard
- In Supabase, add the wildcard redirect URL for password reset
- Grant yourself platform-admin access via SQL
- `vercel.json`'s cron entry deploys automatically with the project
- Update `lib/subdomain.ts` (`ROOT_DOMAINS`) and `lib/cookie-domain.ts` with
  your real domain

## What's next (beyond MVP)

- Expand `lib/countries.ts` toward the full ISO list if global customers
  become a reality
- Verify AfterShip's exact webhook payload shape once real traffic flows,
  and tighten the defensive parsing in the webhook handler accordingly

## Deliberately cut from MVP

Custom domains, theme customization, apps marketplace, multi-currency,
discount codes, customer accounts (guest checkout via email only), handling
of actual returned physical goods after a post-shipment refund, per-item
refund allocation (and therefore per-item restocking on partial refunds).
