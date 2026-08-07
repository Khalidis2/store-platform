create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  attempt_count int not null default 1,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id),
  constraint webhook_events_provider_check check (provider in ('stripe', 'aftership')),
  constraint webhook_events_status_check check (status in ('received', 'processing', 'processed', 'failed')),
  constraint webhook_events_attempt_count_positive_check check (attempt_count >= 1)
);

create index if not exists idx_webhook_events_status_received
  on webhook_events(status, received_at);
