-- Phase 24 secure guest order tracking.
--
-- UUIDv4 tokens provide high-entropy public identifiers that are separate
-- from the order primary key. Existing orders receive a generated token and
-- all future orders get one automatically.

alter table orders
  add column if not exists public_token uuid default gen_random_uuid();

update orders
set public_token = gen_random_uuid()
where public_token is null;

alter table orders
  alter column public_token set default gen_random_uuid(),
  alter column public_token set not null;

create unique index if not exists idx_orders_public_token
  on orders(public_token);
