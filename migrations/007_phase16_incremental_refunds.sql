-- Run this if your database predates Phase 16.
-- has_shipped tracks shipment independently of `status`, since `status` now
-- gets overwritten by refund states (partially_refunded, refunded) and
-- restocking logic needs to know "did this ever ship" regardless of how
-- many partial refunds happened afterward.
alter table orders add column if not exists has_shipped boolean not null default false;

-- Backfill for existing rows: anything currently shipped/delivered, or that
-- has a tracking number, clearly shipped at some point.
update orders set has_shipped = true
where status in ('shipped', 'delivered') or tracking_number is not null;
