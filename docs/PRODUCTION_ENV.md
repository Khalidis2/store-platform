# Production environment contract

Production startup validates critical configuration before serving traffic. The check runs from `instrumentation.ts` and is skipped outside production.

Required in production:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `PLATFORM_ROOT_URL`
- `CRON_SECRET`
- `AFTERSHIP_WEBHOOK_SECRET`

Additional rules:

- `DATABASE_URL` must be a valid `postgres://` or `postgresql://` URL.
- `NEXT_PUBLIC_SUPABASE_URL` must be HTTPS.
- `PLATFORM_ROOT_URL` must be an HTTPS root origin with no path, query, or fragment.
- `EMAIL_FROM` must contain an email address.
- `CRON_SECRET` must be at least 32 characters.
- obvious placeholder secret values are rejected.

`TEST_DATABASE_URL` is intentionally not required at application startup. It is required only when DB-backed tests run, and the test bootstrap separately refuses to use the application database as the test database.

`AFTERSHIP_API_KEY` remains optional because merchant fulfillment still works without automatic carrier registration; the webhook secret is required in production because accepting unsigned delivery callbacks would be unsafe.

If validation fails, the server throws before accepting production traffic and the error lists every invalid variable without printing any secret values.
