alter table stores
  add column shipping_flat_cents int not null default 0,
  add column free_shipping_threshold_cents int;

alter table stores
  add constraint stores_shipping_flat_cents_nonnegative_check
  check (shipping_flat_cents >= 0);

alter table stores
  add constraint stores_free_shipping_threshold_positive_check
  check (free_shipping_threshold_cents is null or free_shipping_threshold_cents > 0);

alter table orders
  add column subtotal_cents int,
  add column shipping_cents int not null default 0;

update orders
set subtotal_cents = total_cents
where subtotal_cents is null;

alter table orders
  alter column subtotal_cents set not null;

alter table orders
  add constraint orders_subtotal_cents_nonnegative_check
  check (subtotal_cents >= 0);

alter table orders
  add constraint orders_shipping_cents_nonnegative_check
  check (shipping_cents >= 0);

alter table orders
  add constraint orders_total_matches_components_check
  check (total_cents = subtotal_cents + shipping_cents);
