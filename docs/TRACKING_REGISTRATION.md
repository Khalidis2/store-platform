# Tracking registration reliability

Shipment state and AfterShip registration are deliberately separate.

- Marking an order shipped records the physical shipment immediately.
- Aramex and Emirates Post tracking numbers enter `pending` registration.
- Registration failures become `failed` with retry metadata instead of being swallowed.
- A worker retries due failures with exponential backoff and reclaims `processing` jobs after a 5-minute lease.
- The merchant Orders page exposes failed/pending/registered state and allows a manual retry.
- Shipped email enqueueing is independent of AfterShip availability.

`/api/cron/tracking-registrations` requires `Authorization: Bearer $CRON_SECRET`.

The repository's Vercel schedule uses a daily Hobby-compatible fallback. Production should invoke the endpoint more frequently with an authenticated scheduler when the deployment plan allows it.
