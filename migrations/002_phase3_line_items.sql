-- Run this if your database was already set up before Phase 3.
-- Fresh installs get this column via schema.sql directly.
alter table orders add column if not exists line_items jsonb not null default '[]'::jsonb;
