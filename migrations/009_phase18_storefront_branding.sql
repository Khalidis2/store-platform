-- Run this if your database predates Phase 18.
alter table stores add column if not exists logo_url text;
alter table stores add column if not exists accent_color text;
alter table stores add column if not exists tagline text;
