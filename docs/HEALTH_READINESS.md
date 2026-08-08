# Health and readiness

The platform exposes two intentionally different operational probes.

## `GET /api/health`

Liveness only. Returns `200 { "status": "ok" }` if the Next.js process can serve requests.

It does not touch Postgres or external providers, so an infrastructure monitor can distinguish a dead app process from a live process whose dependencies are not ready.

## `GET /api/ready`

Readiness. Returns HTTP 200 only when Postgres is reachable and the database has the schema capabilities required by the current Phase 24 application code.

The check verifies:

- a real database round-trip
- required public tables
- Phase 24 columns such as `orders.public_token` and `stores.notification_email`
- named commerce constraints introduced by migration 014

A failed readiness check returns HTTP 503. Responses are always `Cache-Control: no-store`.

The endpoint returns only check names and booleans. It does not expose database URLs, credentials, customer data, row contents, or provider secrets.

## Deployment use

Use `/api/health` for basic liveness monitoring and `/api/ready` for post-deploy readiness checks. A deployment should not be considered ready for merchant traffic until `/api/ready` returns HTTP 200.

The readiness contract checks the resulting schema rather than a migration-history table because this repository supports both fresh installation through `schema.sql` and incremental upgrades through `migrations/`.
