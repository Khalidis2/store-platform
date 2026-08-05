-- Run this if your database predates Phase 23.
alter table products add column if not exists category text;
