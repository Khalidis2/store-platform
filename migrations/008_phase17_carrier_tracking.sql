-- Run this if your database predates Phase 17.
alter table orders add column if not exists carrier text;
