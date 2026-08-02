-- Run this if your database predates Phase 7.
alter table orders add column if not exists inventory_reserved boolean not null default false;
