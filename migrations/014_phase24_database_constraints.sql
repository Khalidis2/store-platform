-- Phase 24 production-readiness hardening.
--
-- These constraints make core commerce invariants enforceable by Postgres,
-- not only by application code. They are added NOT VALID first so Postgres
-- can install them without taking a long validation lock, then validated
-- explicitly. If legacy data violates an invariant, this migration fails at
-- the matching VALIDATE step instead of silently rewriting business data.

alter table stores
  add constraint stores_platform_fee_percent_range_check
  check (platform_fee_percent is null or (platform_fee_percent >= 0 and platform_fee_percent <= 100))
  not valid;

alter table products
  add constraint products_price_cents_nonnegative_check
  check (price_cents >= 0)
  not valid;

alter table products
  add constraint products_inventory_nonnegative_check
  check (inventory is null or inventory >= 0)
  not valid;

alter table orders
  add constraint orders_total_cents_nonnegative_check
  check (total_cents >= 0)
  not valid;

alter table orders
  add constraint orders_refunded_amount_nonnegative_check
  check (refunded_amount_cents >= 0)
  not valid;

alter table orders
  add constraint orders_refunded_amount_not_over_total_check
  check (refunded_amount_cents <= total_cents)
  not valid;

alter table orders
  add constraint orders_status_check
  check (status in (
    'pending',
    'paid',
    'shipped',
    'delivered',
    'expired',
    'partially_refunded',
    'refunded'
  ))
  not valid;

alter table orders
  add constraint orders_carrier_check
  check (carrier is null or carrier in ('aramex', 'emirates_post', 'other'))
  not valid;

alter table audit_log
  add constraint audit_log_actor_role_check
  check (actor_role in ('merchant', 'platform_admin'))
  not valid;

alter table stores validate constraint stores_platform_fee_percent_range_check;
alter table products validate constraint products_price_cents_nonnegative_check;
alter table products validate constraint products_inventory_nonnegative_check;
alter table orders validate constraint orders_total_cents_nonnegative_check;
alter table orders validate constraint orders_refunded_amount_nonnegative_check;
alter table orders validate constraint orders_refunded_amount_not_over_total_check;
alter table orders validate constraint orders_status_check;
alter table orders validate constraint orders_carrier_check;
alter table audit_log validate constraint audit_log_actor_role_check;
