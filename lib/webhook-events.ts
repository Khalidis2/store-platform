import { db } from "./db";

export type WebhookProvider = "stripe" | "aftership";
export const WEBHOOK_PROCESSING_LEASE_MINUTES = 5;

export async function claimWebhookEvent(
  provider: WebhookProvider,
  eventId: string,
  eventType: string,
  payload: unknown
): Promise<number | null> {
  const result = await db.query<{ attempt_count: number }>(
    `insert into webhook_events (
       provider, event_id, event_type, payload, status, attempt_count, processing_started_at
     )
     values ($1, $2, $3, $4::jsonb, 'processing', 1, now())
     on conflict (provider, event_id) do update
       set event_type = excluded.event_type,
           payload = excluded.payload,
           status = 'processing',
           attempt_count = webhook_events.attempt_count + 1,
           error = null,
           processed_at = null,
           processing_started_at = now()
     where webhook_events.status in ('received', 'failed')
        or (
          webhook_events.status = 'processing'
          and webhook_events.processing_started_at <= now() - interval '${WEBHOOK_PROCESSING_LEASE_MINUTES} minutes'
        )
     returning attempt_count`,
    [provider, eventId, eventType, JSON.stringify(payload)]
  );

  return result.rows[0]?.attempt_count ?? null;
}

export async function markWebhookProcessed(provider: WebhookProvider, eventId: string, attempt: number) {
  const result = await db.query(
    `update webhook_events
        set status = 'processed',
            processed_at = now(),
            processing_started_at = null,
            error = null
      where provider = $1
        and event_id = $2
        and status = 'processing'
        and attempt_count = $3`,
    [provider, eventId, attempt]
  );
  return result.rowCount === 1;
}

export async function markWebhookFailed(provider: WebhookProvider, eventId: string, attempt: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const result = await db.query(
    `update webhook_events
        set status = 'failed',
            error = $4,
            processed_at = null,
            processing_started_at = null
      where provider = $1
        and event_id = $2
        and status = 'processing'
        and attempt_count = $3`,
    [provider, eventId, attempt, message.slice(0, 4000)]
  );
  return result.rowCount === 1;
}
