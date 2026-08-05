-- Run this if your database predates Phase 22.
alter table products add column if not exists description text;
