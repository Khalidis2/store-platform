alter table orders add column if not exists tracking_registration_status text not null default 'not_required';
alter table orders add column if not exists tracking_registration_attempt_count int not null default 0;
alter table orders add column if not exists tracking_registration_next_attempt_at timestamptz not null default now();
alter table orders add column if not exists tracking_registration_processing_started_at timestamptz;
alter table orders add column if not exists tracking_registered_at timestamptz;
alter table orders add column if not exists tracking_registration_error text;

update orders
   set tracking_registration_status = 'pending',
       tracking_registration_next_attempt_at = now()
 where status in ('shipped','delivered')
   and tracking_number is not null
   and carrier in ('aramex','emirates_post')
   and tracking_registration_status = 'not_required';

do $$ begin
  alter table orders add constraint orders_tracking_registration_status_check
    check (tracking_registration_status in ('not_required','pending','processing','registered','failed'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table orders add constraint orders_tracking_registration_attempt_count_check
    check (tracking_registration_attempt_count >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table orders add constraint orders_tracking_registration_lease_check
    check ((tracking_registration_status = 'processing') = (tracking_registration_processing_started_at is not null));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table orders add constraint orders_tracking_registration_registered_at_check
    check ((tracking_registration_status = 'registered') = (tracking_registered_at is not null));
exception when duplicate_object then null; end $$;

create index if not exists idx_orders_tracking_registration_due
  on orders(tracking_registration_status, tracking_registration_next_attempt_at)
  where tracking_registration_status in ('pending','failed','processing');
