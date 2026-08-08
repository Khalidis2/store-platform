# Production domain launch

`PLATFORM_ROOT_URL` is the canonical source of truth for production domain behavior. Set it to the public HTTPS root origin, for example `https://shops.example.com`.

## Required DNS / hosting shape

Configure both the canonical root host and its wildcard merchant host in the production hosting project:

- `shops.example.com`
- `*.shops.example.com`

Do not use the deployment's `*.vercel.app` hostname as `PLATFORM_ROOT_URL` for production. Merchant storefront routing and cross-subdomain auth cookies are designed around a real canonical parent domain.

## Provider URLs derived from PLATFORM_ROOT_URL

For `https://shops.example.com`, configure:

- Supabase signup confirmation redirect: `https://shops.example.com/signup/complete`
- Stripe webhook: `https://shops.example.com/api/webhooks/stripe`
- AfterShip webhook: `https://shops.example.com/api/webhooks/aftership`
- Liveness probe: `https://shops.example.com/api/health`
- Readiness probe: `https://shops.example.com/api/ready`

Webhook signing secrets in production must match the secrets configured for those exact provider endpoints.

## Acceptance checks

Before onboarding a real merchant:

1. Root domain loads `/`, `/signup`, and `/platform-admin` without a tenant rewrite.
2. A known tenant at `{subdomain}.shops.example.com` resolves to that store's storefront.
3. An authenticated merchant remains signed in when moving between the canonical root and their merchant subdomain.
4. `/api/health` returns HTTP 200.
5. `/api/ready` returns HTTP 200.
6. Supabase email confirmation returns to `/signup/complete` on the canonical root.
7. A Stripe test checkout reaches the Stripe webhook and transitions the order from `pending` to `paid` exactly once.
8. A synthetic or provider test AfterShip callback reaches the AfterShip webhook and is recorded in `webhook_events`.
9. Customer transactional email contains the secure `/order/{public_token}` URL on the merchant subdomain.
10. Sentry receives a controlled test exception without customer PII.

## Code contract

- `lib/domain-config.ts` derives root hosts, tenant subdomains, cookie scope, and provider URLs.
- `lib/subdomain.ts` delegates tenant extraction to that configuration.
- `lib/cookie-domain.ts` derives the production cookie domain from `PLATFORM_ROOT_URL`.
- Vercel preview hosts are recognized through `VERCEL_URL` so preview root pages are not mistaken for merchant tenants.
