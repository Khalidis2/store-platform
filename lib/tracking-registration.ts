import { db } from "./db";
import { createAftershipTracking, type SupportedCarrier } from "./aftership";
import { logError, logInfo } from "./logger";

const PROCESSING_LEASE_MINUTES = 5;
const MAX_BACKOFF_SECONDS = 60 * 60;

type TrackingJob = {
  id: string;
  store_id: string;
  tracking_number: string;
  carrier: SupportedCarrier;
  tracking_registration_attempt_count: number;
};

export async function processTrackingRegistrations(limit = 25, orderId?: string, storeId?: string) {
  const jobs = await claimTrackingJobs(limit, orderId, storeId);
  let registered = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      await createAftershipTracking({
        trackingNumber: job.tracking_number,
        carrier: job.carrier,
        orderId: job.id,
      });

      const result = await db.query(
        `update orders
            set tracking_registration_status = 'registered',
                tracking_registration_processing_started_at = null,
                tracking_registered_at = now(),
                tracking_registration_error = null
          where id = $1
            and tracking_registration_status = 'processing'
            and tracking_registration_attempt_count = $2`,
        [job.id, job.tracking_registration_attempt_count]
      );

      if (result.rowCount === 1) {
        registered++;
        logInfo("tracking.registration.completed", {
          store_id: job.store_id,
          order_id: job.id,
          carrier: job.carrier,
          tracking_attempt: job.tracking_registration_attempt_count,
        });
      }
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      const backoffSeconds = Math.min(
        MAX_BACKOFF_SECONDS,
        60 * 2 ** Math.max(0, job.tracking_registration_attempt_count - 1)
      );

      await db.query(
        `update orders
            set tracking_registration_status = 'failed',
                tracking_registration_processing_started_at = null,
                tracking_registration_error = $3,
                tracking_registration_next_attempt_at = now() + ($4 * interval '1 second')
          where id = $1
            and tracking_registration_status = 'processing'
            and tracking_registration_attempt_count = $2`,
        [job.id, job.tracking_registration_attempt_count, message.slice(0, 4000), backoffSeconds]
      );

      logError("tracking.registration.failed", err, {
        store_id: job.store_id,
        order_id: job.id,
        carrier: job.carrier,
        tracking_attempt: job.tracking_registration_attempt_count,
      });
    }
  }

  return { claimed: jobs.length, registered, failed };
}

async function claimTrackingJobs(limit: number, orderId?: string, storeId?: string): Promise<TrackingJob[]> {
  const { rows } = await db.query<TrackingJob>(
    `with candidates as (
       select id
         from orders
        where ($2::uuid is null or id = $2::uuid)
          and ($3::uuid is null or store_id = $3::uuid)
          and tracking_number is not null
          and carrier in ('aramex','emirates_post')
          and (
            (tracking_registration_status in ('pending','failed') and tracking_registration_next_attempt_at <= now())
            or (
              tracking_registration_status = 'processing'
              and tracking_registration_processing_started_at < now() - ($4 || ' minutes')::interval
            )
          )
        order by tracking_registration_next_attempt_at asc, created_at asc
        for update skip locked
        limit $1
     )
     update orders o
        set tracking_registration_status = 'processing',
            tracking_registration_processing_started_at = now(),
            tracking_registration_attempt_count = o.tracking_registration_attempt_count + 1,
            tracking_registration_error = null
       from candidates c
      where o.id = c.id
     returning o.id, o.store_id, o.tracking_number, o.carrier, o.tracking_registration_attempt_count`,
    [Math.max(1, Math.min(limit, 100)), orderId ?? null, storeId ?? null, PROCESSING_LEASE_MINUTES]
  );

  return rows;
}
