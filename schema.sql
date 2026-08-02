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
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  price_cents int not null,
  image_url text,
  inventory int default 0,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_email text not null,
  total_cents int not null,
  status text default 'pending',
  stripe_payment_intent_id text,
  created_at timestamptz default now()
);

-- Every query against products/orders MUST filter by store_id.
-- These indexes make that the fast path, not an afterthought.
create index if not exists idx_products_store on products(store_id);
create index if not exists idx_orders_store on orders(store_id);
create index if not exists idx_stores_subdomain on stores(subdomain);
