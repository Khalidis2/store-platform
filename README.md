# Store Platform — Phases 1, 2 & 3

Multi-tenant e-commerce platform, MVP scope. Hand this repo to Claude Code to
keep building.

## What's here

**Phase 1 — tenancy foundation**
- `schema.sql` — stores / products / orders, all tenant-scoped via `store_id`
- `middleware.ts` — resolves `{subdomain}.yourapp.com` and rewrites to `/store/*`
  (this now covers API routes too — see Phase 3 note below)
- `lib/get-store.ts` — the tenant-resolution boundary; every store-scoped
  query filters by `store.id` from here. Resolves from the middleware header
  on page requests, or directly from the Host header as a fallback (needed
  for API routes, which don't get the header)

**Phase 2 — admin dashboard (Supabase Auth)**
- `app/signup/page.tsx` (root domain) — creates a Supabase Auth account +
  store in one flow
- `app/store/login/page.tsx` — merchant login, lives at `{subdomain}/login`
- `app/store/admin/layout.tsx` — the auth + ownership guard every admin
  route sits behind
- `app/store/admin/products/`, `orders/`, `settings/` — product CRUD,
  read-only order list, store name editing

**Phase 3 — real storefront, cart, checkout**
- `app/store/(shop)/` — route group for customer-facing pages (product grid,
  product detail, cart, checkout, order confirmation), separate from admin
- `lib/cart-context.tsx` — client-side cart, persisted to `localStorage`,
  scoped per store so two storefronts never share a cart
- `app/store/api/checkout/route.ts` — creates a **pending** order; re-fetches
  prices from the database rather than trusting the client's cart (a
  tampered request could otherwise set its own prices)
- No real payment collection yet — checkout says so honestly. That's Phase 4.

## Setup

1. `npm install`
2. Create a Supabase project (gives you both Postgres and Auth in one place)
3. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL` and the two
   `NEXT_PUBLIC_SUPABASE_*` values from Project Settings → API
4. Run `schema.sql` against the database — or if you set up the DB before
   Phase 3, just run `migrations/002_phase3_line_items.sql` to add the new
   column
5. In Supabase Auth settings, decide whether to require email confirmation
6. `npm run dev`
7. To test subdomain routing locally, add a hosts file entry, e.g.
   `127.0.0.1 teststore.localhost`, then visit
   `http://teststore.localhost:3000`

## Deploying

- Push to GitHub, import into Vercel
- Add a wildcard domain (`*.yourapp.com`) in Vercel's domain settings
- Set `DATABASE_URL` and the Supabase env vars in Vercel
- Update `lib/subdomain.ts` (`ROOT_DOMAINS`) and `lib/cookie-domain.ts`
  (`ROOT_DOMAIN`) with your real domain

## Not built yet (in order)

- **Phase 4** — Payments: Stripe Connect (Custom accounts, UAE config —
  merchants need a valid UAE trade license to onboard), destination charges,
  wiring the checkout flow to actually collect payment
- **Phase 5** — Order fulfillment loop: webhook → order status → inventory
  decrement on confirmed payment

## Deliberately cut from MVP

Custom domains, theme customization, apps marketplace, multi-currency,
discount codes, customer accounts (guest checkout via email only), password
reset flow, shipping address collection, order search/filtering in admin.
