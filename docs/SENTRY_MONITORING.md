# Sentry error monitoring

Production error reporting uses `SENTRY_DSN` and sends exceptions directly to Sentry's ingest endpoint without adding a new runtime dependency.

Server-side unhandled request errors are captured through Next.js `instrumentation.ts` and its `onRequestError` hook. The report includes only operational metadata such as route path, request method, route type, runtime, and deployment environment.

Browser uncaught errors and unhandled promise rejections are sent to `/api/client-errors`. That endpoint is rate limited before forwarding a minimal event to Sentry. Browser reports intentionally include only error name, truncated message, and `window.location.pathname`; query strings, form data, cookies, customer email, shipping details, and arbitrary rejection payloads are not sent.

The Sentry transport is fail-soft. Monitoring failures never turn a customer request into an application failure.

## Production configuration

Set:

```text
SENTRY_DSN=https://PUBLIC_KEY@SENTRY_HOST/PROJECT_ID
```

`SENTRY_DSN` is validated as part of the existing production environment startup/build checks.

The deployment environment comes from `VERCEL_ENV` when available, and the Sentry release identifier uses `VERCEL_GIT_COMMIT_SHA` when Vercel provides it.

## Validation

After deploying, intentionally trigger a controlled test exception in a non-customer production check, confirm it appears in Sentry, and then remove the test trigger. Do not create a permanent public route whose sole purpose is throwing exceptions.
