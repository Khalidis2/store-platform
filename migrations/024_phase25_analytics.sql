alter table orders add column if not exists paid_at timestamptz;
alter table orders add column if not exists platform_fee_percent_snapshot numeric(5,2);
alter table orders add column if not exists platform_fee_cents int;

update orders
   set paid_at = created_at
 where paid_at is null
   and status in ('paid','shipped','delivered','partially_refunded','refunded');

alter table orders drop constraint if exists orders_platform_fee_percent_snapshot_range_check;
alter table orders add constraint orders_platform_fee_percent_snapshot_range_check
  check (platform_fee_percent_snapshot is null or (platform_fee_percent_snapshot >= 0 and platform_fee_percent_snapshot <= 100)) not valid;
alter table orders validate constraint orders_platform_fee_percent_snapshot_range_check;

alter table orders drop constraint if exists orders_platform_fee_cents_range_check;
alter table orders add constraint orders_platform_fee_cents_range_check
  check (platform_fee_cents is null or (platform_fee_cents >= 0 and platform_fee_cents <= total_cents)) not valid;
alter table orders validate constraint orders_platform_fee_cents_range_check;

alter table orders drop constraint if exists orders_platform_fee_snapshot_pair_check;
alter table orders add constraint orders_platform_fee_snapshot_pair_check
  check ((platform_fee_percent_snapshot is null) = (platform_fee_cents is null)) not valid;
alter table orders validate constraint orders_platform_fee_snapshot_pair_check;

create index if not exists idx_orders_store_paid_at on orders(store_id, paid_at desc) where paid_at is not null;
create index if not exists idx_orders_paid_at on orders(paid_at desc) where paid_at is not null;
