-- Run this if your database predates Phase 14.
alter table stores add column if not exists platform_fee_percent numeric(5,2);

create table if not exists platform_admins (
  user_id uuid primary key,
  created_at timestamptz default now()
);

-- After you've signed up as a merchant (or created any Supabase Auth user
-- for yourself), find your user id in Supabase Auth -> Users, then run:
--   insert into platform_admins (user_id) values ('YOUR-USER-ID-HERE');
-- There's no self-service way to grant this — that's intentional.
