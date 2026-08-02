-- Run this if your database predates Phase 6.
alter table orders add column if not exists shipping_address jsonb not null default '{}'::jsonb;
alter table orders add column if not exists tracking_number text;
