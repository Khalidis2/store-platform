# Roadmap — what's missing and what's next

For how the app currently works, see [ARCHITECTURE.md](ARCHITECTURE.md).
This document is the honest gap list: what was deliberately left out of
MVP scope, what's genuinely missing for real merchants to rely on this,
and what's worth building next, roughly in priority order.

## Blocking real use

These aren't nice-to-haves — without them, the platform can't actually be
handed to real merchants yet.

1. **Custom domain with wildcard DNS.** Nothing tenant-specific (a
   merchant's storefront, checkout, branding) is reachable on the current
   Vercel deployment (`store-platform-ten.vercel.app`) because Vercel's
   free domain doesn't support wildcard subdomains. This is the single
   highest-leverage next step — it unblocks everything else being
   visible/testable in production at once. After adding one: update
   `ROOT_DOMAINS` (`lib/subdomain.ts`), add the wildcard domain in
   Vercel's dashboard, add the Supabase Auth wildcard redirect URL, and
   re-register the AfterShip webhook if in use.

2. **Separate the production database from the local test database.**
   Right now local dev and the live Vercel deployment point at the exact
   same Supabase project — meaning every test order, test store, and test
   webhook call made from a laptop has been writing to what's nominally
   "production." Fine for this pass; not fine once real merchants exist.

3. **No automated tests.** Every piece of behavior in this app (inventory
   race safety, refund idempotency, webhook signature verification,
   Server Action authorization, multi-tenant isolation) was verified
   *manually*, once, in a single testing session. None of it is regression
   -protected. The cross-tenant authorization bypass fixed this session is
   exactly the kind of bug a test suite exists to catch on the next
   change — a test asserting "Server Action X rejects a non-owner" for
   each of the eight store-admin actions would be a good starting set,
   plus one for the inventory reservation race and one for refund
   idempotency.

## Deliberately cut from MVP (still true)

Unchanged from the original scope decision, listed here for visibility:
custom domains *per merchant* (distinct from the platform's own domain,
above), a real theme editor (see below — basic branding now exists, a
full editor doesn't), an apps marketplace, multi-currency, discount
codes, real customer accounts (checkout is guest-only), handling of
physically returned goods, and per-item refund allocation/restocking
(refunds are order-level, not per line item).

## Product gaps

- **No order-related emails to customers.** Confirmation is a web page
  (`/order-confirmation/[id]`) the customer sees once, right after
  paying — there's no email sent when an order is placed, shipped, or
  delivered. A customer who closes that tab has no way to find their
  order again (no accounts, so no order history to log into either).
- **No merchant notifications.** A merchant only learns about a new order
  by checking `/admin/orders` themselves — no email/webhook/notification
  when one comes in.
- **No storefront search, filtering, or categories.** The storefront is a
  single flat grid of every product: fine for a handful of items, breaks
  down past a couple dozen.
- **No low-stock alerts.** A merchant discovers they're out of stock when
  a customer hits "Out of stock" on the product page, not before.
- **No merchant analytics beyond the one revenue number** on the
  dashboard. No sales-over-time, no per-product performance, nothing.
- **Storefront branding is minimal.** Phase 18 added a logo, an accent
  color, and a tagline — real theming (layout choice, fonts, section
  ordering, custom pages) doesn't exist. Every store's *structure* still
  looks identical.
- **Product data is minimal.** One image (a URL, not an upload), no
  variants (size/color), no rich description field, no categories/tags.
- **Country list is now the full ISO 3166-1 set**, but there's still no
  concept of per-country shipping rates, tax, or availability — every
  country is treated identically at checkout.

## Infra / operational gaps

- **No image upload or storage.** `logo_url` and `product.image_url` are
  both just free-text URL fields — a merchant has to host their own
  images somewhere else and paste in a link.
- **No rate limiting** on login, signup, or checkout. Relies entirely on
  Supabase Auth's own built-in protections for the auth endpoints; the
  app's own routes (`/api/checkout`, `/api/stores`) have none.
- **No audit log.** Platform-admin actions (changing another store's fee
  percent) and merchant actions (refunds, deletions) aren't logged
  anywhere beyond the row they modified — no "who did what, when" trail.
- **Secrets rotation is entirely manual** (Stripe webhook secret,
  AfterShip webhook secret, `CRON_SECRET` all have to be regenerated and
  redeployed by hand if compromised).
- **AfterShip's webhook payload shape was verified against their current
  public docs, not live carrier traffic** (no real Aramex/Emirates Post
  shipment has ever actually gone through it) — the defensive fallback
  parsing in `app/api/webhooks/aftership/route.ts` exists because of this
  residual uncertainty and shouldn't be removed until real traffic
  confirms the primary shape holds.

## Suggested order of attack

1. Custom domain (unblocks visible/testable production)
2. Separate prod/test databases
3. Order confirmation + shipping-update emails to customers (biggest gap
   in actually being usable by a real merchant's real customers)
4. A handful of authorization/regression tests, specifically covering the
   Server Action ownership pattern documented in ARCHITECTURE.md — this
   is the class of bug most likely to silently reappear when a new
   admin action gets added later
5. Image upload (logo + product photos) instead of raw URL fields
6. Everything else in this document, roughly in the order listed
