# Production Acceptance Gate

Do not launch merchants until the automated smoke check passes and every manual lifecycle item below is signed off in the real production environment.

## Automated smoke gate

Run:

```bash
PLATFORM_ROOT_URL=https://shops.example.com \
ACCEPTANCE_STORE_SUBDOMAIN=acceptance \
npm run acceptance:production
```

The acceptance store must already exist and be reachable at `{ACCEPTANCE_STORE_SUBDOMAIN}.{root-domain}`.

The smoke runner verifies:

- `/api/health` returns healthy
- `/api/ready` confirms Postgres and required schema
- root signup route is reachable
- wildcard merchant storefront routing works
- unsigned Stripe webhook requests are rejected
- unsigned AfterShip webhook requests are rejected
- a custom HTTPS domain is being used rather than `*.vercel.app`

Any failure is a launch blocker.

## Merchant lifecycle acceptance

- [ ] Create a new merchant account using a production-safe test email.
- [ ] Complete Supabase email confirmation and land on `/signup/complete`.
- [ ] Create a store and confirm the chosen wildcard subdomain resolves.
- [ ] Confirm the authenticated session works on the merchant subdomain.
- [ ] Upload a store logo and verify it renders publicly.
- [ ] Create a product with image, valid AED price, inventory, description, and category.
- [ ] Confirm a second merchant cannot modify the first merchant's products or Storage paths.
- [ ] Connect the merchant Stripe account and confirm the store becomes live only after the expected Stripe account state.

## Customer purchase acceptance

- [ ] Browse the storefront while signed out.
- [ ] Add a product to cart and enter a UAE shipping address.
- [ ] Create the order and open Stripe Checkout.
- [ ] Complete a test payment using the configured Stripe test-mode setup before real-money launch.
- [ ] Confirm only one inventory reservation occurs for repeated payment-session requests.
- [ ] Confirm the Stripe webhook marks the order paid exactly once.
- [ ] Confirm the customer receives the order-confirmation email.
- [ ] Confirm the merchant receives the paid-order notification.
- [ ] Open the secure customer order link and confirm it uses the public token rather than relying on the internal order ID for authorization.
- [ ] Confirm the order link does not expose customer email or shipping address.

## Fulfillment acceptance

- [ ] Mark the paid order shipped.
- [ ] Confirm tracking number and carrier are persisted.
- [ ] Confirm the customer receives the shipped email.
- [ ] For Aramex or Emirates Post, confirm the AfterShip tracking registration succeeds in the production integration.
- [ ] Deliver the tracking event and confirm the order advances to delivered only once.
- [ ] Confirm the delivered email is sent.

## Refund acceptance

- [ ] Issue a partial refund and confirm cumulative refunded amount and status.
- [ ] Redeliver the same partial-refund webhook and confirm no duplicate state change occurs.
- [ ] Complete the remaining refund and confirm full-refund status.
- [ ] Confirm unshipped full refunds restore inventory exactly once.
- [ ] Confirm shipped orders are not restocked by refunds.
- [ ] Confirm refund email delivery.

## Operations and failure acceptance

- [ ] Verify Stripe and AfterShip webhook events appear in `webhook_events` as processed.
- [ ] Force a safe webhook processing failure and confirm it records `failed`, returns non-2xx, and succeeds on retry.
- [ ] Force a webhook row to remain `processing` beyond the five-minute lease and confirm the next delivery reclaims it with an incremented attempt.
- [ ] Confirm an older webhook worker cannot finalize a newer reclaimed attempt.
- [ ] Force Resend to reject a notification and confirm the email remains in `email_outbox` as `failed` with a future `next_attempt_at`.
- [ ] Restore Resend delivery, invoke `/api/cron/email-outbox` with `CRON_SECRET`, and confirm the same outbox row becomes `sent` without a duplicate notification.
- [ ] Confirm production invokes the email outbox worker at an acceptable interval for customer notifications.
- [ ] Verify checkout/store-creation rate limits return HTTP 429 with `Retry-After`.
- [ ] Verify `/api/ready` returns 503 when a required schema capability is absent in a disposable environment.
- [ ] Trigger a safe test exception and confirm it appears in Sentry without customer PII or secrets.
- [ ] Confirm production logs contain structured event names and request/order correlation context.
- [ ] Run the stale-reservation cron and confirm abandoned inventory reservations are released.

## External provider configuration sign-off

- [ ] Vercel has both the canonical custom domain and wildcard domain attached to the production project.
- [ ] DNS for the root and wildcard host resolves to the production Vercel project.
- [ ] Supabase Site URL and redirect allowlist include the canonical production signup/auth callback URLs.
- [ ] Stripe webhook endpoint points to `/api/webhooks/stripe` and uses the matching production secret.
- [ ] AfterShip webhook endpoint points to `/api/webhooks/aftership` and uses the matching production secret.
- [ ] Resend sender/domain is verified and production delivery succeeds.
- [ ] Sentry DSN receives both server and browser test events.

## Launch decision

Launch is approved only when:

1. `npm run acceptance:production` exits with code 0.
2. The full merchant, customer, fulfillment, refund, operations, and provider checklists above are complete.
3. No unresolved P0 defect remains from the acceptance run.
4. The production deployment uses the intended custom domain and production database.
