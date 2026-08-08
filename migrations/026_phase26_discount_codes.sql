create table if not exists discounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  code text not null,
  discount_type text not null,
  discount_value int not null,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint discounts_code_format_check check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  constraint discounts_type_check check (discount_type in ('percent','fixed')),
  constraint discounts_value_check check ((discount_type = 'percent' and discount_value between 1 and 100) or (discount_type = 'fixed' and discount_value > 0)),
  constraint discounts_window_check check (starts_at is null or ends_at is null or starts_at < ends_at),
  constraint discounts_max_redemptions_check check (max_redemptions is null or max_redemptions > 0),
  unique (store_id, code)
);

alter table orders add column if not exists discount_id uuid references discounts(id) on delete set null;
alter table orders add column if not exists discount_code text;
alter table orders add column if not exists discount_type text;
alter table orders add column if not exists discount_value int;
alter table orders add column if not exists discount_cents int not null default 0;

alter table orders drop constraint if exists orders_total_matches_components_check;
alter table orders add constraint orders_discount_cents_range_check check (discount_cents >= 0 and discount_cents <= subtotal_cents) not valid;
alter table orders validate constraint orders_discount_cents_range_check;
alter table orders add constraint orders_discount_snapshot_consistency_check check (
  (discount_id is null and discount_code is null and discount_type is null and discount_value is null and discount_cents = 0)
  or
  (discount_code is not null and discount_type in ('percent','fixed') and discount_value is not null and discount_value > 0 and discount_cents >= 0)
) not valid;
alter table orders validate constraint orders_discount_snapshot_consistency_check;
alter table orders add constraint orders_total_matches_components_check check (total_cents = subtotal_cents - discount_cents + shipping_cents) not valid;
alter table orders validate constraint orders_total_matches_components_check;

create table if not exists discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references discounts(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  order_id uuid not null unique references orders(id) on delete cascade,
  status text not null default 'reserved',
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  constraint discount_redemptions_status_check check (status in ('reserved','redeemed','released'))
);

create index if not exists idx_discounts_store_active on discounts(store_id, is_active, code);
create index if not exists idx_discount_redemptions_discount_status on discount_redemptions(discount_id, status);
