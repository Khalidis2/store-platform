import { db } from "./db";

export type WebhookProvider = "stripe" | "aftership";

type StartResult = {
  shouldProcess: boolean;
};

export async function startWebhookEvent(
  provider: WebhookProvider,
  eventId: string,
  eventType: string,
  payload: unknown
): Promise<StartResult> {
  const { rows } = await db.query<{ status: string }>(
    `insert into webhook_events (provider, event_id, event_type, payload, status, attempt_count)
     values ($1, $2, $3, $4::jsonb, 'processing', 1)
     on conflict (provider, event_id) do update
       set attempt_count = webhook_events.attempt_count + 1,
           status = case when webhook_events.status = 'processed' then 'processed' else 'processing' end,
           error = case when webhook_events.status = 'processed' then webhook_events.error else null end
     returning status`,
    [provider, eventId, eventType, JSON.stringify(payload)]
  );

  return { shouldProcess: rows[0]?.status !== "processed" };
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
