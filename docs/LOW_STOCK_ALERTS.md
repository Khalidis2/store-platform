# Low-stock alerts

The platform uses the existing global low-stock threshold of 5 units.

Merchant alerts are sent to `stores.notification_email` only after a Stripe Checkout Session is successfully paid. Inventory reservation alone does not send an alert, so abandoned checkouts do not create false-positive emails.

`products.low_stock_alerted_at` is a durable deduplication latch. A paid order may claim the latch only when the product is active, inventory is at or below the threshold, and the latch is null. This makes concurrent paid orders safe: only one claims the alert.

When inventory is manually replenished or restored above the threshold after an expired checkout or an eligible full refund, the latch is cleared. The next future drop to 5 or fewer units can alert again.

Existing products already at or below the threshold are marked as acknowledged by migration 025 so deployment does not trigger an immediate alert blast. New products created at or below the threshold are also treated as already acknowledged until they are replenished above the threshold and later cross it again.

Email delivery remains fail-soft like the platform's other transactional email. There is no durable email outbox/retry queue yet; if Resend fails after the alert latch is claimed, the message can be missed rather than duplicated.
