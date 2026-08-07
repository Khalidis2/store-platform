import { db } from "./db";

export type WebhookProvider = "stripe" | "aftership";

export async function claimWebhookEvent(
  provider: WebhookProvider,
  eventId: string,
  eventType: string,
  payload: unknown
): Promise<boolean> {
  const inserted = await db.query(
    `insert into webhook_events (provider, event_id, event_type, payload, status, attempt_count)
     values ($1, $2, $3, $4::jsonb, 'processing', 1)
     on conflict (provider, event_id) do nothing
     returning id`,
    [provider, eventId, eventType, JSON.stringify(payload)]
  );
  if (inserted.rowCount === 1) return true;

  const retried = await db.query(
    `update webhook_events
        set status = 'processing',
            attempt_count = attempt_count + 1,
            error = null,
            processed_at = null
      where provider = $1 and event_id = $2 and status = 'failed'
      returning id`,
    [provider, eventId]
  );
  if (retried.rowCount === 1) return true;

  await db.query(
    `update webhook_events
        set attempt_count = attempt_count + 1
      where provider = $1 and event_id = $2 and status in ('processing', 'processed')`,
    [provider, eventId]
  );
  return false;
}

export async function markWebhookProcessed(provider: WebhookProvider, eventId: string) {
  await db.query(
    `update webhook_events
        set status = 'processed', processed_at = now(), error = null
      where provider = $1 and event_id = $2`,
    [provider, eventId]
  );
}

export async function markWebhookFailed(provider: WebhookProvider, eventId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await db.query(
    `update webhook_events
        set status = 'failed', error = $3, processed_at = null
      where provider = $1 and event_id = $2`,
    [provider, eventId, message.slice(0, 4000)]
  );
}
