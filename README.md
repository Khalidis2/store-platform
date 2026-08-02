# Store Platform — Phase 1 (Tenancy Foundation)

Multi-tenant e-commerce platform, MVP scope. This is the starting point for the
full build — hand this repo to Claude Code to continue.

## What's here (Phase 1 — done)
- `schema.sql` — stores / products / orders tables, all tenant-scoped via `store_id`
- `middleware.ts` — resolves `{subdomain}.yourapp.com` and rewrites to `/store/*`
- `lib/get-store.ts` — the single tenant-resolution boundary; every store-scoped
  query must go through this and filter by `store.id`
- `app/api/stores/route.ts` — store signup (creates a new tenant)
- `app/store/page.tsx` — placeholder storefront proving subdomain routing works
- `app/page.tsx` — root domain placeholder (marketing/signup lives here)

## Setup
1. `npm install`
2. Create a Postgres DB (Supabase or Neon recommended — both integrate cleanly
   with Vercel)
3. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL`
4. Run `schema.sql` against your database
5. `npm run dev`
6. To test subdomain routing locally, add entries to your hosts file, e.g.
   `127.0.0.1 teststore.localhost`, then visit `http://teststore.localhost:3000`

## Deploying
- Push to GitHub, import into Vercel
- Add a wildcard domain (`*.yourapp.com`) in Vercel's domain settings —
  required before subdomain routing works in production
- Set `DATABASE_URL` in Vercel's environment variables

## Not built yet (in order)
- **Phase 2** — Admin dashboard: product CRUD, order list, store settings
- **Phase 3** — Real storefront: product listing/detail, cart, checkout UI
- **Phase 4** — Payments: Stripe Connect (Custom accounts, UAE config —
  merchants need a valid UAE trade license to onboard), destination charges
- **Phase 5** — Order fulfillment loop: webhook → order status → inventory

## Deliberately cut from MVP
Custom domains, theme customization, apps marketplace, multi-currency,
discount codes, customer accounts (guest checkout via email only).
