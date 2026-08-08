# Durable email outbox

Transactional notifications are persisted in `email_outbox` before delivery is attempted. Each business event uses a deterministic `dedupe_key`, so retries can safely enqueue the same notification without sending duplicates.

The outbox stores the rendered recipient, subject, and HTML snapshot. A later order or store edit therefore does not change an already-enqueued notification.

Delivery flow:

1. Insert the notification with status `pending`.
2. Attempt immediate delivery through Resend using the outbox `dedupe_key` as the provider idempotency key.
3. On failure, keep the row as `failed` and set `next_attempt_at` using exponential backoff capped at one hour.
4. `/api/cron/email-outbox` reclaims due failed/pending jobs and processing jobs whose five-minute lease expired.
5. Successful jobs become `sent` and retain the Resend message id when returned.

The endpoint requires `Authorization: Bearer $CRON_SECRET`.

`vercel.json` includes a once-daily fallback retry that is compatible with Vercel Hobby. For production notification latency, invoke `/api/cron/email-outbox` at least every five minutes using Vercel Pro/Enterprise cron or another authenticated scheduler. Do not configure a sub-daily Vercel Cron expression on Hobby because Vercel rejects those deployments.

Resend idempotency keys protect duplicate API sends during provider retries for 24 hours. The database `dedupe_key` remains the permanent application-level uniqueness boundary.

Operational checks:

- alert on old `failed` rows or stale `processing` rows
- verify `recipient`, `subject`, and `html` are treated as sensitive operational data
- verify the production scheduler sends the `CRON_SECRET` bearer token
- periodically inspect retry counts and `last_error`
