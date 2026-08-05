-- Phase 1 MVP schema
-- Every tenant-owned table carries store_id for isolation.

create extension if not exists "pgcrypto";

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  subdomain text unique not null,
  name text not null,
  owner_user_id uuid not null,
  stripe_account_id text,
  is_live boolean default false,
  platform_fee_percent numeric(5,2),
  -- Phase 18 — basic storefront branding. All optional; storefront falls
  -- back to plain text/default styling when unset.
  logo_url text,
  accent_color text,
  tagline text,
  created_at timestamptz default now()
);

-- Not a role flag on the stores/users table by design — platform-admin
-- access is deliberately a separate table with no self-service way to join
-- it, since it controls other merchants' fee rates.
create table if not exists platform_admins (
  user_id uuid primary key,
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  price_cents int not null,
  image_url text,
  inventory int default 0,
  description text, -- Phase 22
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_email text not null,
  total_cents int not null,
  status text default 'pending',
  stripe_payment_intent_id text,
  line_items jsonb not null default '[]'::jsonb,
  shipping_address jsonb not null default '{}'::jsonb,
  tracking_number text,
  carrier text,
  inventory_reserved boolean not null default false,
  refunded_amount_cents int not null default 0,
  has_shipped boolean not null default false,
  created_at timestamptz default now()
);

-- Phase 21 — "who did what, when" trail for the highest-stakes actions
-- (refunds, product deletion, platform-admin fee changes). store_id is
-- always the affected store, even when actor_role is 'platform_admin' and
-- the actor isn't that store's owner — a merchant should be able to see
-- when a platform admin touched their store, not just when they did it
-- themselves.
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade,
  actor_user_id uuid not null,
  actor_role text not null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Every query against products/orders MUST filter by store_id.
-- These indexes make that the fast path, not an afterthought.
create index if not exists idx_products_store on products(store_id);
create index if not exists idx_orders_store on orders(store_id);
create index if not exists idx_stores_subdomain on stores(subdomain);
create index if not exists idx_audit_log_store on audit_log(store_id);
