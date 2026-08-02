-- Run this if your database predates Phase 10.
alter table orders add column if not exists refunded_amount_cents int not null default 0;
