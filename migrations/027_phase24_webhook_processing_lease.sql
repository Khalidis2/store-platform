alter table webhook_events
  add column if not exists processing_started_at timestamptz;

update webhook_events
   set processing_started_at = received_at
 where status = 'processing'
   and processing_started_at is null;

alter table webhook_events
  drop constraint if exists webhook_events_processing_lease_check;

alter table webhook_events
  add constraint webhook_events_processing_lease_check
  check ((status = 'processing') = (processing_started_at is not null));

create index if not exists idx_webhook_events_processing_lease
  on webhook_events(processing_started_at)
  where status = 'processing';
