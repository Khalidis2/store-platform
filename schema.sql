create extension if not exists "pgcrypto";

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  subdomain text unique not null,
  name text not null,
  owner_user_id uuid not null,
  stripe_account_id text,
  is_live boolean default false,
  status text not null default 'draft',
  platform_fee_percent numeric(5,2),
  logo_url text,
  accent_color text,
  tagline text,
  notification_email text,
  shipping_flat_cents int not null default 0,
  free_shipping_threshold_cents int,
  created_at timestamptz default now(),
  constraint stores_platform_fee_percent_range_check
    check (platform_fee_percent is null or (platform_fee_percent >= 0 and platform_fee_percent <= 100)),
  constraint stores_status_check check (status in ('draft','active','suspended','closed')),
  constraint stores_shipping_flat_cents_nonnegative_check check (shipping_flat_cents >= 0),
  constraint stores_free_shipping_threshold_positive_check
    check (free_shipping_threshold_cents is null or free_shipping_threshold_cents > 0)
);

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
  description text,
  category text,
  status text not null default 'draft',
  created_at timestamptz default now(),
  constraint products_price_cents_nonnegative_check check (price_cents >= 0),
  constraint products_inventory_nonnegative_check check (inventory >= 0),
  constraint products_status_check check (status in ('draft','active','archived'))
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  public_token uuid not null unique default gen_random_uuid(),
  customer_email text not null,
  subtotal_cents int not null,
  shipping_cents int not null default 0,
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
  created_at timestamptz default now(),
  constraint orders_total_cents_nonnegative_check check (total_cents >= 0),
  constraint orders_subtotal_cents_nonnegative_check check (subtotal_cents >= 0),
  constraint orders_shipping_cents_nonnegative_check check (shipping_cents >= 0),
  constraint orders_total_matches_components_check check (total_cents = subtotal_cents + shipping_cents),
  constraint orders_refunded_amount_nonnegative_check check (refunded_amount_cents >= 0),
  constraint orders_refunded_amount_not_over_total_check check (refunded_amount_cents <= total_cents),
  constraint orders_status_check check (status in ('pending','paid','shipped','delivered','expired','partially_refunded','refunded')),
  constraint orders_carrier_check check (carrier is null or carrier in ('aramex','emirates_post','other'))
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade,
  actor_user_id uuid not null,
  actor_role text not null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  constraint audit_log_actor_role_check check (actor_role in ('merchant','platform_admin'))
);

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe','aftership')),
  event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received','processing','processed','failed')),
  attempt_count int not null default 1 check (attempt_count >= 1),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

create table if not exists rate_limits (
  scope text not null,
  subject text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (scope, subject, window_start)
);

create index if not exists idx_products_store on products(store_id);
create index if not exists idx_products_store_status on products(store_id, status);
create index if not exists idx_orders_store on orders(store_id);
create index if not exists idx_stores_subdomain on stores(subdomain);
create index if not exists idx_stores_status on stores(status);
create index if not exists idx_audit_log_store on audit_log(store_id);
create index if not exists idx_webhook_events_status_received on webhook_events(status, received_at);
create index if not exists idx_rate_limits_window_start on rate_limits(window_start);
