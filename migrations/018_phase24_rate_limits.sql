create table if not exists rate_limits (
  scope text not null,
  subject text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (scope, subject, window_start)
);

create index if not exists idx_rate_limits_window_start
  on rate_limits(window_start);
