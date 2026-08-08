# Observability

Production-critical application events are emitted as one-line JSON logs through `lib/logger.ts`.

Each log contains at minimum:

- `timestamp`
- `level`
- `event`

Money-critical request paths should also include safe identifiers where available:

- `request_id`
- `store_id`
- `order_id`
- provider event IDs such as `stripe_event_id`

Do not log passwords, authentication/session values, webhook secrets, API keys, customer emails, phone numbers, shipping addresses, card data, or raw provider payloads.

`lib/logger.ts` redacts context keys containing common sensitive names as defense in depth, but callers must still pass only operational metadata.

Current event families include:

- `checkout.*`
- `inventory.*`
- `webhook.stripe.*`
- `webhook.aftership.*`
- `email.*`

The output is directly searchable in Vercel logs and is deliberately vendor-neutral so a later Sentry/log-drain integration can ingest the same events without changing business logic.
