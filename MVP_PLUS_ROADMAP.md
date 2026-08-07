# Store Platform — MVP+ Execution Roadmap

This document is the execution source of truth for taking the current Store Platform from a feature-rich prototype to a production-safe MVP+, then to a controlled commercial launch.

The goal is not to keep adding features indefinitely. The goal is to make the complete transaction lifecycle reliable, secure, observable, and usable by real UAE merchants and customers with minimal manual intervention.

## Final product goal

A merchant should be able to:

1. Register and verify their email.
2. Create a store.
3. Configure branding and store settings.
4. Connect Stripe.
5. Add products with images, descriptions, prices, categories, and inventory.
6. Publish the store on a real merchant subdomain.
7. Receive a paid customer order.
8. Fulfill and track the order.
9. Issue partial or full refunds safely.
10. Receive operational notifications and see useful business metrics.

A customer should be able to:

1. Visit a merchant storefront.
2. Browse/search/filter products.
3. Add products to cart.
4. Enter shipping information.
5. Pay securely.
6. Receive an order confirmation email.
7. Re-open the order through a secure guest tracking link.
8. Receive shipping, delivery, and refund updates.

The platform owner should be able to:

1. View merchants and platform activity.
2. Set merchant platform fees.
3. Suspend/reactivate stores.
4. Investigate failures through logs and audit history.
5. Monitor platform GMV, platform revenue, orders, refunds, and failed operations.

---

# Current status

The repository already implements a broad MVP feature set, including:

- Multi-tenant stores and subdomain routing.
- Supabase Auth.
- Merchant ownership checks.
- Platform-admin access and merchant fee percentages.
- Product CRUD.
- Product descriptions, categories, image upload, and inventory.
- Store logo, tagline, and accent color.
- Cart and guest checkout.
- Stripe Connect destination-charge flow.
- Inventory reservation and stale-reservation release.
- Paid, shipped, delivered, expired, partially-refunded, and refunded order states.
- Full and incremental partial refunds.
- AfterShip tracking for supported carriers.
- Basic dashboard metrics.
- Order filtering/search.
- Storefront product search and category filtering.
- Low-stock visibility.
- Audit logging for high-risk actions.
- Initial automated tests around authorization, inventory reservation, and order/refund logic.

The project is therefore beyond a basic feature MVP. The remaining highest-value work is production readiness, reliability, security, customer communication, merchant onboarding, and operational tooling.

---

# Development rule from this point forward

Until Phase 24 is complete, do not prioritize unrelated feature expansion.

Do not build these yet unless they become necessary for the launch:

- Customer accounts.
- Wishlists.
- Reviews.
- Loyalty systems.
- Marketplace/apps ecosystem.
- Advanced theme editor.
- Drag-and-drop page builder.
- Multi-currency.
- International tax engine.
- AI product generation.
- Native mobile apps.
- Multi-warehouse inventory.
- ERP/POS integrations.
- Subscription products.
- Wholesale/B2B workflows.

Root-cause fixes, security fixes, test coverage, and production-readiness work always take priority over new features.

---

# Phase 24 — Production Readiness

Priority: P0

This phase is the launch blocker. The product must not be considered production-ready until every launch gate at the end of this document passes.

## 24.1 Real root domain and wildcard merchant subdomains

Configure a real platform domain and wildcard DNS.

Required shape:

```text
platform-domain.tld
*.platform-domain.tld
```

Merchant storefronts must resolve as:

```text
merchant.platform-domain.tld
```

Required work:

- Configure the root domain in Vercel.
- Configure wildcard DNS.
- Configure wildcard domain in Vercel.
- Update `ROOT_DOMAINS` in `lib/subdomain.ts`.
- Verify `COOKIE_DOMAIN` behavior.
- Configure Supabase Auth wildcard redirect URLs.
- Update Stripe webhook URL if the production host changes.
- Update AfterShip webhook URL if enabled.
- Verify root-domain pages are not rewritten as tenant pages.
- Verify merchant subdomains are correctly rewritten to `/store/*`.

Acceptance criteria:

- Root signup/login pages work on the real domain.
- At least two merchant subdomains resolve correctly.
- Merchant sessions remain valid across root domain and merchant subdomain where intended.
- Tenant lookup always resolves the correct store.

## 24.2 Environment separation

Create completely separate environments.

Minimum required:

```text
Development
Production
```

Preferred:

```text
Development
Staging
Production
```

Each environment should have its own:

- Supabase project/database.
- Supabase Auth configuration.
- Storage bucket/policies.
- Stripe configuration.
- Webhook secrets.
- Cron secret.
- AfterShip configuration where applicable.

Critical rule:

`npm test` must never run DB-backed integration tests against production.

Recommended follow-up:

- Add an explicit test database URL such as `TEST_DATABASE_URL`.
- Make DB-backed tests refuse to run when the target database is marked production.

Acceptance criteria:

- Dev/test rows cannot appear in production.
- Production webhooks cannot modify development data.
- Tests fail safely when no test database is configured.

## 24.3 Schema and migration verification from zero

Create a new empty non-production Supabase project and prove a full clean setup works.

Test:

- `schema.sql`.
- Every required migration.
- Supabase Storage setup.
- Auth configuration.
- Platform-admin bootstrap.

Acceptance criteria:

- A brand-new environment can be created from repository instructions without undocumented manual database fixes.

## 24.4 Transactional email

Recommended provider: Resend.

Runner-up: Postmark.

Customer emails:

- Order confirmed.
- Payment confirmed if separate from order confirmation.
- Order shipped.
- Order delivered.
- Refund processed.

Merchant emails:

- New paid order.
- Refund completed/failed.
- Low-stock notification.

Order confirmation should include:

- Store name.
- Order reference.
- Items.
- Quantity.
- Unit prices.
- Order total.
- Shipping address.
- Current status.
- Secure order tracking link.

Email delivery failure must not roll back a successful payment/order. Email should be retriable independently.

## 24.5 Secure guest order tracking

Because customer accounts are intentionally deferred, customers need a secure way to reopen their order.

Add a cryptographically random public order token.

Recommended model:

```text
orders.public_token
```

Create a customer-facing route such as:

```text
/order/{public_token}
```

Show only the information appropriate for the customer.

Suggested timeline:

```text
Confirmed
Preparing
Shipped
Delivered
```

Also show:

- Tracking number.
- Carrier.
- Refund state.
- Store contact/policy links where available.

Security requirements:

- Raw order UUID alone must not be treated as authorization.
- Tokens must be high-entropy and unguessable.
- Cross-store access must be impossible.

## 24.6 Rate limiting and abuse protection

Add application-level rate limiting to sensitive endpoints and workflows.

Protect at minimum:

- Signup.
- Login-related app routes if applicable.
- Password reset request flows where controlled by the app.
- Store creation.
- Checkout/order creation.
- Checkout payment-session creation.
- Any public endpoint that can create expensive work.

Recommended approach:

- Upstash Redis + rate-limit library, or an equivalent Vercel-compatible managed rate-limit mechanism.

Requirements:

- Key by a combination of IP and user/store identity where appropriate.
- Return proper HTTP 429 responses.
- Avoid blocking Stripe/AfterShip webhook delivery with customer-facing rate-limit rules.

## 24.7 Supabase Storage RLS hardening

Current application-level ownership checks should remain, but Storage should also enforce tenant isolation as defense in depth.

Target model:

```text
Server Action getOwnedStore()
+
store-prefixed storage path
+
Storage RLS validating the authenticated user's ownership of that store path
```

Acceptance criteria:

- Merchant A cannot overwrite Merchant B's product or logo objects, even if Merchant A knows the exact object path.

## 24.8 Database constraints and state validation

Add database-level CHECK constraints for core invariants.

At minimum:

```text
price_cents >= 0
inventory >= 0
total_cents >= 0
refunded_amount_cents >= 0
platform_fee_percent >= 0
platform_fee_percent <= 100
```

Constrain known enum-like values where practical:

- Order status.
- Actor role.
- Carrier if using a fixed set.
- Store status when added.
- Product status when added.

Application validation remains necessary, but impossible states should also be rejected by Postgres.

## 24.9 Error monitoring and observability

Recommended: Sentry.

Capture at minimum:

- Checkout failures.
- Stripe webhook failures.
- Refund failures.
- Database errors.
- Email delivery errors.
- AfterShip integration errors.
- Authentication/session errors.

Attach useful non-secret context:

- `store_id`.
- `order_id`.
- Provider event ID.
- Request/correlation ID.

Never log:

- Passwords.
- Session tokens.
- Card data.
- Webhook secrets.
- API secrets.

## 24.10 Structured application logging

Move important business events away from ad-hoc logging.

Example event:

```json
{
  "event": "order.payment.completed",
  "store_id": "...",
  "order_id": "...",
  "stripe_event_id": "..."
}
```

Important event classes:

- Checkout created.
- Inventory reserved/released.
- Payment completed.
- Payment failed.
- Order shipped.
- Order delivered.
- Refund requested/completed/failed.
- Webhook rejected.
- Email queued/sent/failed.

## 24.11 Webhook event persistence and idempotency

Add a provider webhook event table.

Suggested fields:

```text
id
provider
event_id
event_type
payload
status
attempt_count
received_at
processed_at
error
```

Suggested statuses:

```text
received
processing
processed
failed
```

Requirements:

- Unique provider/event ID constraint.
- Duplicate deliveries must be harmless.
- Processing failures should be visible and retriable.
- Stripe and AfterShip signature validation must be enforced in production.

## 24.12 Full end-to-end acceptance test

Run the complete lifecycle against staging or a production-like environment.

Required scenario:

1. Merchant registers.
2. Merchant verifies email.
3. Merchant creates store.
4. Merchant configures store.
5. Merchant connects Stripe test account.
6. Merchant adds product and image.
7. Customer visits real merchant subdomain.
8. Customer adds product to cart.
9. Customer checks out.
10. Inventory reserves correctly.
11. Customer pays through Stripe test mode.
12. Stripe webhook updates order exactly once.
13. Merchant receives new-order email.
14. Customer receives confirmation email.
15. Customer can open secure order tracking link.
16. Merchant marks order shipped.
17. Customer receives shipping notification.
18. Delivered transition works.
19. Partial refund works.
20. Second partial refund works.
21. Full remaining refund works.
22. Duplicate webhook delivery does not duplicate state transitions.
23. Audit log is correct.
24. Inventory behavior is correct.
25. No cross-tenant data becomes visible.

Also test two concurrent checkouts attempting to reserve the final unit of stock. Exactly one must succeed.

---

# Phase 25 — Merchant Launch Experience

Priority: P1

Begin only after the Phase 24 launch blockers are substantially complete.

## 25.1 Merchant onboarding checklist

Add a setup-progress experience.

Suggested tasks:

```text
Create store
Upload logo
Add first product
Connect payments
Configure shipping
Publish store
```

Dashboard should clearly show:

- Setup percentage.
- Missing steps.
- `View my store` action.

## 25.2 Store lifecycle

Do not make Stripe readiness the only store lifecycle concept.

Add a store status, for example:

```text
draft
active
suspended
closed
```

Sales should require both:

- Store is active.
- Payment account is ready.

Platform admin must be able to suspend/reactivate stores without deleting data.

## 25.3 UAE-first shipping settings

Avoid an international shipping engine initially.

For first launch, support a simple UAE shipping model.

Minimum merchant configuration:

- Flat UAE shipping rate.
- Optional free-shipping threshold.
- Shipping enabled/disabled.

Possible later enhancement:

- Emirate-level rates.

Do not add complex zone/carrier pricing until merchant feedback proves the need.

## 25.4 Store policies and contact information

Allow each merchant storefront to expose:

- Shipping policy.
- Returns/refund policy.
- Contact information.

Platform-level pages needed before commercial launch:

- Terms of Service.
- Privacy Policy.
- Merchant Terms.
- Contact/support.
- Any required cookie/privacy disclosures.

## 25.5 Product lifecycle

Add product status instead of relying primarily on deletion.

Suggested states:

```text
draft
active
archived
```

Merchants should normally archive products instead of deleting them.

Permanent deletion can remain available for products with no historical dependency where safe.

## 25.6 Storefront pagination and sorting

Current search/filtering should be extended before large catalogs are supported.

Recommended initial pagination:

```text
24 products per page
```

Add simple sorting:

- Newest.
- Price low to high.
- Price high to low.

Avoid faceted search and complex taxonomy until necessary.

---

# Phase 26 — MVP+

Priority: P1/P2

This phase makes the product materially stronger than a minimal launch while keeping scope controlled.

## 26.1 Merchant analytics

Provide only actionable metrics first:

- Sales today.
- Sales last 7 days.
- Sales last 30 days.
- Orders.
- Average order value.
- Top products.
- Units sold.
- Refund amount/count.

Avoid building a full analytics platform.

## 26.2 Platform-admin analytics

Add:

- Merchant count.
- Active merchant count.
- GMV.
- Platform revenue.
- Orders.
- Refunds.
- Failed payments/operations.
- Stores requiring attention.

Per store show:

- Store.
- Owner.
- Created date.
- Store status.
- Stripe readiness.
- Product count.
- Order count.
- GMV.
- Platform fee percentage.
- Platform revenue.

## 26.3 Low-stock notifications

Existing low-stock visibility should gain notification behavior.

Initial delivery channel:

- Merchant email.

Do not spam repeatedly for the same stock level. Trigger on threshold crossing or maintain notification state.

## 26.4 Discount codes

After core stability is proven, add a deliberately small promotion system.

Supported types:

- Percentage discount.
- Fixed AED discount.

Suggested fields:

```text
code
type
value
minimum_order
starts_at
expires_at
usage_limit
active
```

Do not build complex stackable promotion rules initially.

## 26.5 Order management improvements

Improve merchant workflows based on beta feedback, potentially including:

- Better order timeline.
- Internal merchant notes.
- Clearer exception/error state visibility.
- Export to CSV if merchants request it.

Only add capabilities proven useful during beta.

---

# Phase 27 — Post-launch expansion

Priority: P2

Build only after real merchants are using the platform and core reliability metrics are healthy.

Candidates:

- Product variants (size/color).
- Merchant custom domains.
- Better normalized categories.
- Per-item refunds and restocking.
- More shipping providers.
- Advanced analytics/export.
- Basic theme/layout choices.

Product variants should likely be the first major commerce-model expansion because they affect catalog design, inventory, cart line identity, order snapshots, refunds, and reporting.

---

# Phase 28+ — Later product expansion

Priority: P3+

Only pursue with clear commercial justification.

Candidates:

- Customer accounts/order history.
- Reviews.
- Wishlists.
- Loyalty.
- Advanced themes/page builder.
- Multi-currency.
- International tax engine.
- Marketplace/apps ecosystem.
- Subscriptions.
- Wholesale/B2B.
- POS.
- Multi-warehouse inventory.
- Native mobile apps.

---

# Currency strategy

Initial launch recommendation:

```text
AED only
```

Continue storing monetary values as integer minor units.

Examples:

```text
5500 -> AED 55.00
```

Longer term, fields named `*_cents` may be renamed to `*_minor` if multi-currency is ever introduced.

Do not implement multi-currency for the initial launch.

---

# UAE tax/VAT work

Before onboarding real merchants, define and verify the business/legal model for UAE VAT and receipts/invoices.

Potential future data concepts:

- Merchant legal name.
- TRN.
- Tax registration status.
- Tax rate.
- Tax-inclusive/exclusive pricing behavior.
- Invoice/receipt numbering.

Do not invent tax behavior in code. Production implementation should follow verified UAE accounting/legal requirements.

---

# Order data model strategy

The current JSONB line-item snapshot is acceptable for MVP because historical order names/prices must remain immutable after catalog edits.

Keep this for Phase 24/25.

Later, analytics and per-item refund requirements may justify an `order_items` table with immutable snapshot fields such as:

```text
product_id
product_name
unit_price_minor
quantity
line_total_minor
```

Do not refactor solely for theoretical normalization before a concrete feature needs it.

---

# Background jobs strategy

Vercel Cron is acceptable for MVP.

Potential future queued/background work:

- Transactional email retries.
- Inventory expiration.
- Webhook retry processing.
- Tracking updates.
- Low-stock alerts.
- Analytics aggregation.

Do not introduce a queue system before the reliability requirements justify the extra infrastructure.

---

# Beta plan

After Phase 24 and the essential Phase 25 items pass, onboard a controlled beta of approximately 3-5 real merchants.

Prefer merchants with different catalog/fulfillment patterns.

Measure:

- Signup success rate.
- Time to create store.
- Time to first product.
- Time to connect payments.
- Time to first live order.
- Checkout conversion.
- Payment failures.
- Fulfillment time.
- Refund frequency.
- Support requests.
- Application errors.
- Webhook failures.

Use beta behavior to decide Phase 26/27 scope. Do not assume every requested feature deserves implementation.

---

# MVP launch gate

The platform is not MVP-ready until all of the following are verified in a production-like environment.

## Infrastructure

- [ ] Real root domain configured.
- [ ] Wildcard merchant subdomains configured.
- [ ] Development/test and production databases are separate.
- [ ] Stripe test/live environments are correctly separated.
- [ ] Required environment variables are validated.
- [ ] Fresh schema/migration setup succeeds from zero.
- [ ] Production backups/recovery procedure is documented.

## Merchant flow

- [ ] Merchant can register.
- [ ] Email verification works.
- [ ] Merchant can complete store setup.
- [ ] Merchant can access admin on the correct tenant.
- [ ] Merchant can upload logo.
- [ ] Merchant can add/edit product.
- [ ] Product image upload works.
- [ ] Inventory changes correctly.
- [ ] Merchant can connect Stripe.
- [ ] Store can be activated/published.

## Tenant security

- [ ] Merchant A cannot read Merchant B admin data.
- [ ] Merchant A cannot mutate Merchant B data through Server Actions.
- [ ] Merchant A cannot overwrite Merchant B storage objects.
- [ ] Platform-admin authorization is verified independently.

## Customer flow

- [ ] Customer can browse storefront.
- [ ] Search works.
- [ ] Category filtering works.
- [ ] Product page works.
- [ ] Cart works.
- [ ] Customer can enter shipping details.
- [ ] Checkout works.
- [ ] Payment completes.
- [ ] Customer receives confirmation email.
- [ ] Customer can securely reopen the order.

## Inventory

- [ ] Reservation is atomic.
- [ ] Two simultaneous purchases of the final unit cannot both succeed.
- [ ] Abandoned/expired checkout releases inventory.
- [ ] Release logic is idempotent.

## Payments and webhooks

- [ ] Stripe webhook signature verification works.
- [ ] Completed checkout moves order to paid exactly once.
- [ ] Duplicate Stripe events are harmless.
- [ ] Webhook events are observable/recoverable.
- [ ] Platform fee is correct.
- [ ] Merchant destination amount is correct.

## Fulfillment

- [ ] Merchant can mark paid order shipped.
- [ ] Tracking number is stored.
- [ ] Carrier is stored.
- [ ] Shipping email is sent.
- [ ] Delivered transition works manually.
- [ ] AfterShip delivered transition works when configured.

## Refunds

- [ ] Partial refund works.
- [ ] Multiple partial refunds work.
- [ ] Full refund works.
- [ ] Refund webhook redelivery is harmless.
- [ ] Correct inventory restock behavior occurs.
- [ ] Customer refund email is sent.
- [ ] Audit log records the action.

## Reliability/security

- [ ] Rate limiting works.
- [ ] Database constraints reject invalid states.
- [ ] Error monitoring is active.
- [ ] Structured logging covers critical business events.
- [ ] Secrets are not logged.
- [ ] Production webhook secrets are configured.

---

# Definition of MVP+

MVP+ is reached when:

1. Every MVP launch gate above passes.
2. Merchant onboarding is clear enough that a new merchant can set up without developer help.
3. Simple UAE shipping settings exist.
4. Customer and merchant transactional email exists.
5. Secure guest order tracking exists.
6. Platform and merchant analytics cover the essential metrics.
7. Low-stock notification exists.
8. At least one controlled beta cycle has been completed and critical failures fixed.

At that point, the project should be ready for a controlled commercial launch and should no longer be treated as an experimental prototype.

---

# Priority order

Use this order unless a production bug/security issue overrides it:

1. Domain + wildcard tenancy.
2. Environment/database separation.
3. Clean migration verification.
4. Transactional email.
5. Secure guest order tracking.
6. Rate limiting.
7. Storage RLS hardening.
8. Database invariants/constraints.
9. Monitoring and structured logging.
10. Webhook event persistence/retry visibility.
11. Full end-to-end acceptance test.
12. Merchant onboarding.
13. Store lifecycle/publishing.
14. UAE shipping settings.
15. Store policies/contact pages.
16. Product archive/status.
17. Pagination/sorting.
18. Merchant analytics.
19. Platform analytics.
20. Low-stock notifications.
21. Discount codes.
22. Beta-driven improvements.
23. Variants/custom domains/other post-launch expansion.

---

# Working principle for future development

For every future change:

1. Confirm which roadmap item it advances.
2. Prefer fixing root causes over adding workarounds.
3. Preserve tenant isolation.
4. Preserve payment/refund idempotency.
5. Add or update tests for security-critical and money-critical behavior.
6. Verify migrations against a non-production database.
7. Do not weaken authorization to simplify UI flows.
8. Do not couple successful payment/order processing to optional integrations such as email or tracking.
9. Keep production configuration separate from test configuration.
10. Update this roadmap when an item is completed, intentionally deferred, or replaced by a better design.
