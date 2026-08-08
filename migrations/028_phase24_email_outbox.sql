create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  store_id uuid references stores(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  kind text not null,
  recipient text not null,
  subject text not null,
  html text not null,
  status text not null default 'pending',
  attempt_count int not null default 0,
  next_attempt_at timestamptz not null default now(),
  processing_started_at timestamptz,
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint email_outbox_status_check check (status in ('pending','processing','failed','sent')),
  constraint email_outbox_attempt_count_nonnegative_check check (attempt_count >= 0),
  constraint email_outbox_processing_lease_check check ((status = 'processing') = (processing_started_at is not null)),
  constraint email_outbox_sent_at_check check ((status = 'sent') = (sent_at is not null))
);

create index if not exists idx_email_outbox_due
  on email_outbox(status, next_attempt_at)
  where status in ('pending','failed','processing');
