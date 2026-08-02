# Store Platform — Phases 1 & 2

Multi-tenant e-commerce platform, MVP scope. Hand this repo to Claude Code to
keep building.

## What's here

**Phase 1 — tenancy foundation**
- `schema.sql` — stores / products / orders, all tenant-scoped via `store_id`
- `middleware.ts` — resolves `{subdomain}.yourapp.com` and rewrites to `/store/*`
- `lib/get-store.ts` — the tenant-resolution boundary; every store-scoped
  query filters by `store.id` from here

**Phase 2 — admin dashboard (Supabase Auth)**
- `app/signup/page.tsx` (root domain) — creates a Supabase Auth account +
  store in one flow
- `app/store/login/page.tsx` — merchant login, lives at `{subdomain}/login`
- `app/store/admin/layout.tsx` — the auth + ownership guard every admin
  route sits behind (checks both "is logged in" and "owns this store")
- `app/store/admin/page.tsx` — dashboard home (product/order/revenue counts)
- `app/store/admin/products/` — product CRUD (Server Actions)
- `app/store/admin/orders/` — read-only order list
- `app/store/admin/settings/` — store name editing + Stripe status placeholder
- `lib/supabase-server.ts` / `lib/supabase-browser.ts` — Supabase clients
- `lib/cookie-domain.ts` — **update `ROOT_DOMAIN` here** before deploying, or
  merchant login sessions won't carry over to the subdomain

## Setup

1. `npm install`
2. Create a Supabase project (gives you both Postgres and Auth in one place)
3. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL` and the two
   `NEXT_PUBLIC_SUPABASE_*` values from Project Settings → API
4. Run `schema.sql` against the database (Supabase SQL editor, or `psql`)
5. In Supabase Auth settings, decide whether to require email confirmation —
   if it's on, new merchants must confirm their email before they can create
   a store (the signup page handles this case but it's worth knowing about
   before you test)
6. `npm run dev`
7. To test subdomain routing locally, add a hosts file entry, e.g.
   `127.0.0.1 teststore.localhost`, then visit
   `http://teststore.localhost:3000`

## Deploying

- Push to GitHub, import into Vercel
- Add a wildcard domain (`*.yourapp.com`) in Vercel's domain settings
- Set `DATABASE_URL` and the Supabase env vars in Vercel
- **Update `lib/cookie-domain.ts`** with your real root domain — this is
  what lets a merchant's login session (set on the root domain during
  signup) be recognized on their own subdomain

## Not built yet (in order)

- **Phase 3** — Real storefront: product listing/detail, cart, checkout UI
- **Phase 4** — Payments: Stripe Connect (Custom accounts, UAE config —
  merchants need a valid UAE trade license to onboard), destination charges
- **Phase 5** — Order fulfillment loop: webhook → order status → inventory

## Deliberately cut from MVP

Custom domains, theme customization, apps marketplace, multi-currency,
discount codes, customer accounts (guest checkout via email only), password
reset flow, forgot-password on the login page.
