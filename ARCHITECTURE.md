# How this app works

This document describes the intended behavior and architecture of Store
Platform, independent of any one phase's commit history. See
[README.md](README.md) for setup/deploy instructions and a phase-by-phase
changelog; see [ROADMAP.md](ROADMAP.md) for what's missing or planned.

## What it is

A multi-tenant e-commerce platform. One deployment serves many independent
merchant stores, each reachable at its own subdomain
(`{merchant}.yourapp.com`), sharing one codebase and one database but fully
isolated from each other. The platform owner (you) takes a percentage fee
on every sale, collected automatically via Stripe.

Think: a small, self-hosted, single-region alternative to the "give every
merchant their own storefront" part of Shopify — without the app
marketplace, theme editor, or ecosystem.

## The three roles

**Platform owner** — runs the deployment, sees every store via
`/platform-admin`, sets each store's fee percentage. Access is granted by
inserting a row into `platform_admins` directly via SQL; there is
deliberately no self-service way to become one.

**Merchant** — signs up at the root domain, creates a store, manages it at
`{subdomain}/admin`. Owns exactly the data under their own `store_id`.

**Customer** — browses a merchant's storefront, checks out as a guest (no
account — see [ROADMAP.md](ROADMAP.md) for why that might change),
receives a confirmation link.

## Tenancy: how a request finds its store

`middleware.ts` reads the `Host` header on every request and calls
`extractSubdomain()` (`lib/subdomain.ts`). If the host isn't in
`ROOT_DOMAINS`, everything left of the first dot is treated as the tenant
subdomain, the request is rewritten to `/store/*`, and the subdomain is
passed downstream via an `x-store-subdomain` header.

`getCurrentStore()` (`lib/get-store.ts`) reads that header (or re-derives
it from `Host` directly, for API routes middleware doesn't rewrite the
same way) and looks up the matching row in `stores`. This function is the
entire tenant-isolation boundary — every store-scoped page, API route, and
query starts here, then filters by `store.id`.

**`ROOT_DOMAINS` must exactly match every domain the deployment is
reachable on.** Get this wrong and the root marketing/signup pages get
mis-routed as if they were a tenant subdomain (this happened during the
first Vercel deploy — see the commit history around
`chore/configure-vercel-root-domain`).

### The `getCurrentStore()` vs `getOwnedStore()` distinction — read this before adding a Server Action

`getCurrentStore()` answers "which store does this request belong to,"
purely from the subdomain. It does **not** tell you whether the person
making the request is authorized to act as that store's owner.

`app/store/admin/layout.tsx` checks `user.id === store.owner_user_id`
before rendering any admin page — but that check only runs on a normal
page navigation. **Next.js Server Actions are directly invocable HTTP
endpoints; the enclosing layout's Server Component body does not re-run
before one executes.** A Server Action that only calls `getCurrentStore()`
has no authorization check at all — any signed-in user, owner of any store
or none, can invoke it against a store they don't own.

This was a real, shipped vulnerability (fixed in the commit titled *"Fix
cross-tenant authorization bypass in every store-admin Server Action"*).
**Every Server Action that mutates store-scoped data must call
`getOwnedStore()` instead**, which additionally verifies the caller's
session against `store.owner_user_id`. `getCurrentStore()` remains correct
for page/API-route rendering, where the layout (or, for guest-facing
routes like checkout, the lack of any auth requirement at all) already
establishes the right context.

## Data model

```
stores           — one row per merchant. subdomain (unique), owner_user_id,
                    stripe_account_id, is_live, platform_fee_percent,
                    logo_url / accent_color / tagline (branding, all optional)
platform_admins  — user_id allowlist, no self-service join path
products         — store_id-scoped, price_cents, inventory
orders           — store_id-scoped, status, line_items (jsonb snapshot,
                    not a live join to products), shipping_address (jsonb),
                    inventory_reserved, refunded_amount_cents, has_shipped
```

`orders.line_items` is a frozen JSON snapshot taken at order-creation time
(name, price, quantity) — not a foreign-key relationship to `products`.
This is intentional: an order must keep showing what the customer actually
paid even if the merchant later renames or deletes the product.

`orders.has_shipped` is separate from `orders.status` because `status`
gets overwritten by refund states (`refunded`, `partially_refunded`) —
without a dedicated flag, a refund on an already-shipped order would lose
track of whether restocking is appropriate.

## Auth

Supabase Auth (email/password) for both merchants and platform admins —
same user pool, distinguished only by whether a `platform_admins` row
exists and which `stores.owner_user_id` matches, not by a role field.

Sessions live in cookies written by `@supabase/ssr`. **Session refresh
happens in `middleware.ts`**, not in Server Components — Next.js forbids
writing cookies from a plain page render, so if the access token needs
refreshing there, it silently fails to persist. `middleware.ts` runs
`supabase.auth.getUser()` on every request specifically to keep a fresh
token in cookies before any Server Component tries to read one.

In production, `COOKIE_DOMAIN` (`lib/cookie-domain.ts`) is set to
`.{root domain}` so a merchant's session, once established, is recognized
across their store's subdomain — this only matters once a real domain
with wildcard subdomains is in place; see ROADMAP.

## Signup flow

Two steps, deliberately: `/signup` collects only email + password.
Supabase's "confirm your email" setting (the platform default) means no
session exists yet at that point, so nothing else can be created safely.
Once the user confirms (or immediately, if confirmation is disabled),
`/signup/complete` picks up the now-authenticated session and collects the
store name/subdomain, then calls `POST /api/stores`.

(An earlier single-step version of this flow tried to create the store
inline during signup and silently dead-ended for anyone using Supabase's
default settings — every account created that way had no way to ever
finish setup. Don't collapse this back into one step without re-solving
that.)

## Payments: Stripe Connect

Each store gets a Stripe **Custom** connected account
(`stores.stripe_account_id`), created with only the `transfers` capability
requested — **not** `card_payments`. Stripe rejects `card_payments` for
`AE`-country Custom accounts outright, and it isn't needed anyway:

Checkout uses **destination charges** — the platform's own Stripe account
processes the actual card charge (via `stripe.checkout.sessions.create`
with `payment_intent_data.transfer_data.destination` set to the
merchant's connected account and `application_fee_amount` computed from
`platform_fee_percent`), then Stripe automatically transfers the
merchant's cut. The connected account only ever *receives* a transfer, so
it only needs `transfers`.

A store is "live" (`stores.is_live`) only once Stripe reports
`charges_enabled && details_submitted` via the `account.updated` webhook.
Checkout is blocked for non-live stores.

## Order lifecycle

```
pending → paid → shipped → delivered
   ↓        ↓        ↓
expired   refunded / partially_refunded (from paid, shipped, or partially_refunded)
```

- **pending → paid**: `checkout.session.completed` webhook, guarded by
  `where status = 'pending'` for idempotency against Stripe redelivery.
- **pending → expired**: either the `checkout.session.expired` webhook
  (buyer abandoned the Stripe payment page) or the daily cron sweep
  (`releaseStaleReservations`, backstop for the rare case the webhook
  never arrives) — both release the reserved inventory.
- **paid → shipped**: merchant action, optionally registers tracking with
  AfterShip if the carrier is Aramex or Emirates Post.
- **shipped → delivered**: merchant action, *or* automatically via the
  AfterShip webhook when a tracking's `tag` becomes `Delivered` — both
  paths go through the same `markOrderDelivered()`.
- **→ refunded / partially_refunded**: merchant-initiated
  (`refundOrder` action calls Stripe directly, then `applyRefund()`), and
  redundantly confirmed by the `charge.refunded` webhook — both call the
  same idempotent `applyRefund()`, which guards on current status so a
  redelivered webhook after the order's already reached that state is a
  safe no-op. Supports multiple incremental partial refunds on the same
  order. Restocking on a refund that reaches "fully refunded" only
  happens if `has_shipped` is false.

## Inventory reservation

Stock is reserved (decremented) when a Checkout Session is created
(`/api/checkout/pay`), not when the order row is first created
(`/api/checkout` only does an optimistic pre-check). The actual
reservation is atomic and race-safe by construction:

```sql
update products set inventory = inventory - $1
where id = $2 and store_id = $3 and inventory >= $1
returning id
```

Two concurrent requests for the last unit can't both succeed — the second
UPDATE simply matches zero rows once the first has taken the stock, which
throws `InsufficientStockError` and rolls back the whole transaction
(including any other items in the same multi-item order that had already
been decremented earlier in the same loop — reservation is all-or-nothing
per order).

Reserved-but-unpaid stock is released by whichever of the expiry paths
above fires first.

## Carrier tracking

AfterShip is used as a tracking aggregator for Aramex and Emirates Post
rather than integrating each carrier directly (Aramex's API is SOAP/XML
and needs a business account to test against; Emirates Post has no public
API at all). `lib/aftership.ts` registers a tracking number when a
merchant marks an order shipped; the webhook handler
(`app/api/webhooks/aftership/route.ts`) auto-advances the order to
`delivered` on a `Delivered` tag. Both fail soft if `AFTERSHIP_API_KEY` /
`AFTERSHIP_WEBHOOK_SECRET` aren't configured — a merchant marking
something shipped should never be blocked by a tracking-registration
hiccup, and the tracking number is always stored as plain text regardless.

## Deployment shape

Vercel, connected to this GitHub repo for auto-deploy on push to `main`.
Env vars must be set for **both** the Production and Preview environments
— a Preview build that's missing `STRIPE_SECRET_KEY`, for instance, fails
at build time (`new Stripe()` runs at module load in `lib/stripe.ts`),
not just at runtime.

Vercel's free `*.vercel.app` domain cannot serve wildcard merchant
subdomains — only a real domain with wildcard DNS can. Until one is
added, the deployment is only useful for testing root-domain flows
(signup, platform-admin); no merchant storefront is reachable on it. See
[ROADMAP.md](ROADMAP.md).
