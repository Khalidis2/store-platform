# Store Platform — Phases 1–22

Multi-tenant e-commerce platform, MVP scope. Hand this repo to Claude Code to
keep building.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the app actually works (data
model, tenancy, auth, payments, order lifecycle) and
[ROADMAP.md](ROADMAP.md) for what's missing and what to build next.

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

**Phase 18 — basic storefront branding**
- Merchants can set a logo, an accent color, and a tagline from store
  settings (`stores.logo_url` / `accent_color` / `tagline`, all optional —
  logo upload itself arrived in Phase 19, see below)
- The storefront header shows the logo (or the store name as plain text if
  unset) and the tagline; the three primary CTAs (Add to cart, Proceed to
  checkout, Continue to payment) render with the accent color via a
  `--store-accent` CSS custom property set in the shop layout
- A store with nothing set renders exactly as before this phase

**Phase 19 — real image upload (logo + product photos), plus first automated tests**
- Store logo and product images are now uploaded files, not pasted URLs —
  `lib/upload-image.ts` uploads to a Supabase Storage bucket
  (`store-images`) using the merchant's own authenticated session, so
  RLS on `storage.objects` (not a service-role key) is what enforces
  "must be signed in" — see `migrations/010_phase19_image_upload.sql`
  for the bucket + policy setup a fresh Supabase project needs
- JPEG/PNG/WEBP/GIF, 5MB max, enforced in `lib/upload-image.ts`
- First automated tests in the repo (`npm test`, via Vitest) — see
  "Automated tests" below

**Phase 20 — low-stock visibility**
- Merchant dashboard shows a "Low stock" count alongside the existing
  Products/Orders/Needs shipping/Revenue tiles, linking to the products
  page
- The products page flags individual rows "Out of stock" (0) or
  "Low stock" (`LOW_STOCK_THRESHOLD`, fixed at 5 in `lib/inventory.ts`)
- No notification/email when a product crosses the threshold — a
  merchant still has to check the dashboard

**Phase 21 — activity log for refunds, product deletion, and fee changes**
- New `audit_log` table (`migrations/011_phase21_audit_log.sql`) records
  who did what, when — scoped to the three actions ROADMAP.md flagged as
  the concrete gap: refunds, product deletion, and platform-admin fee
  changes. Not every mutation is logged, deliberately.
- `store_id` on each entry is always the *affected* store, even when
  `actor_role` is `platform_admin` and the actor isn't that store's
  owner — a merchant can see `/admin/audit-log` and find out when a
  platform admin touched their store, not just their own actions.
- `lib/audit.ts`'s `logAction()` is the single write path, called from
  `refundOrder`, `deleteProduct`, and platform-admin's `updateStoreFee`.

**Phase 22 — product descriptions and full product editing**
- Products gain a plain-text `description` column, shown on the
  storefront product page (line breaks preserved, no rich text/markdown)
- Products can now be fully edited after creation — name, price,
  inventory, description, and optionally a new image — at
  `/admin/products/[id]/edit`, via the new `updateProduct` action.
  Previously `updateInventory` was the only way to change anything about
  an existing product; a typo in the name or price had no fix short of
  deleting and recreating it.

## Setup

1. `npm install`
2. Create a Supabase project (Postgres + Auth)
3. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL`, the two
   `NEXT_PUBLIC_SUPABASE_*` values, `STRIPE_SECRET_KEY`, and `CRON_SECRET`
4. Run `schema.sql` against the database (or run the migrations in
   `migrations/` in order, if upgrading an existing DB)
5. Run `migrations/010_phase19_image_upload.sql` against the database —
   `schema.sql` only covers the public schema, not Supabase Storage, so
   this one's needed even for a brand-new project (sets up the
   `store-images` bucket and its RLS policies for logo/product uploads)
6. In Supabase Auth → URL Configuration, add a wildcard redirect URL for
   your domain (needed for password reset across subdomains)
7. Sign up as a merchant for yourself, then grant yourself platform-admin
   access — see `migrations/006_phase14_platform_admin.sql`
8. (Optional) Sign up for AfterShip, get an API key, and configure a
   webhook pointing at `/api/webhooks/aftership` for automated carrier
   tracking — otherwise tracking numbers are just stored as free text
9. `npm run dev`
10. **Stripe webhook (local testing)**: install the Stripe CLI, run
    `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, put the
    signing secret it prints into `STRIPE_WEBHOOK_SECRET`
11. To test subdomain routing locally, add a hosts file entry, e.g.
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
- If production uses a different Supabase project than local dev, run
  `migrations/010_phase19_image_upload.sql` against it too — logo/product
  uploads will fail with a permissions error otherwise
- Grant yourself platform-admin access via SQL
- `vercel.json`'s cron entry deploys automatically with the project
- Update `lib/subdomain.ts` (`ROOT_DOMAINS`) and `lib/cookie-domain.ts` with
  your real domain

## What's next (beyond MVP)

- `lib/countries.ts` now has the full ISO 3166-1 list (199 countries).
- AfterShip's webhook payload shape has been verified against their current
  public API docs (top-level `{event, event_id, msg: {...}}`, with `tag`
  and `order_id` inside `msg`) and confirmed end-to-end against the
  handler in `app/api/webhooks/aftership/route.ts` using a synthetic
  payload matching that shape — not live carrier traffic, so the
  defensive fallback parsing (`body.tracking` / bare `body`) stays in
  place as a safety net in case AfterShip's actual delivery differs from
  their docs.

## Testing this end to end locally

This has been built and pushed but never actually run against a live
Supabase/Stripe test setup. Here's the concrete checklist to do that —
written for whoever (likely Claude Code, in an environment that can
actually run `npm run dev` and reach the network) picks this up next.

**1. Supabase**
- Create a free project at supabase.com
- Project Settings → API: copy the Project URL and anon public key
- Project Settings → Database: copy the connection string (`DATABASE_URL`)
- SQL Editor: paste and run `schema.sql`
- Authentication → URL Configuration: add `http://localhost:3000/**` as a
  redirect URL

**2. Stripe (test mode)**
- Dashboard defaults to test mode — grab the test secret key
  (`sk_test_...`) from Developers → API keys
- Install the Stripe CLI, run
  `stripe listen --forward-to localhost:3000/api/webhooks/stripe` — it
  prints a webhook signing secret, that's `STRIPE_WEBHOOK_SECRET`

**3. Local env**
- `git clone` this repo, `npm install`
- Copy `.env.example` → `.env.local`, fill in everything from steps 1–2
- Generate `CRON_SECRET` with `openssl rand -hex 32`
- AfterShip vars can stay blank for this pass — carrier tracking isn't
  needed to validate the core flow
- `npm run dev`

**4. The actual walkthrough**
- Sign up at `localhost:3000/signup`, create a store
- In Supabase, add yourself to `platform_admins` (see
  `migrations/006_phase14_platform_admin.sql`) so `/platform-admin` works
- In store admin → settings, click "Connect Stripe" — Stripe's test mode
  onboarding accepts fake business details, no real trade license needed
  in test mode
- Add a product, then buy it from the storefront using Stripe's test card
  `4242 4242 4242 4242`, any future expiry, any CVC
- Watch the order move through the full lifecycle: `pending` → `paid` →
  mark shipped → mark delivered
- Try a refund (full and partial) and confirm the Stripe dashboard (test
  mode) reflects it
- Try adding two items with limited stock and racing two checkouts against
  the last unit, to sanity-check the inventory reservation logic actually
  holds up outside of code review

Nothing in this checklist has been run yet — treat the first pass through
it as the real first test of this codebase, not a formality.

## Automated tests

`npm test` runs the Vitest suite in `tests/`. Two kinds of coverage:

- **DB-backed integration tests** (`tests/inventory.test.ts`,
  `tests/orders.test.ts`) exercise `lib/inventory.ts` and `lib/orders.ts`
  against a real Postgres connection (`DATABASE_URL` from `.env.local`) —
  including the inventory reservation race (two concurrent requests for
  the last unit, only one should win) and refund idempotency. Each test
  creates its own store/product/order fixtures and cleans them up
  afterward; **they run against whatever database `DATABASE_URL` points
  at**, which today is the same database as local dev and production (see
  ROADMAP.md) — don't point this at a database you don't want test rows
  transiently appearing in.
- **`tests/server-action-authorization.test.ts`** is a static check, not a
  DB test: it reads every `"use server"` file's source and asserts each
  exported action calls `getOwnedStore()` (or `getPlatformAdminUser()` for
  platform-admin) rather than the unchecked `getCurrentStore()`. This is
  the regression test for the cross-tenant Server Action authorization
  bug — see ARCHITECTURE.md for why that check has to be independent of
  whatever layout the action's page happens to sit under.

## Deliberately cut from MVP

Custom domains, theme customization, apps marketplace, multi-currency,
discount codes, customer accounts (guest checkout via email only), handling
of actual returned physical goods after a post-shipment refund, per-item
refund allocation (and therefore per-item restocking on partial refunds).
