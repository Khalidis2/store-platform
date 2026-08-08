import { db } from "./db";
import { logError, logInfo, logWarn } from "./logger";

const PROCESSING_LEASE_MINUTES = 5;
const MAX_BACKOFF_SECONDS = 60 * 60;

type EmailJob = {
  id: string;
  dedupe_key: string;
  store_id: string | null;
  order_id: string | null;
  kind: string;
  recipient: string;
  subject: string;
  html: string;
  attempt_count: number;
};

export async function enqueueEmail(input: {
  dedupeKey: string;
  storeId?: string | null;
  orderId?: string | null;
  kind: string;
  recipient: string;
  subject: string;
  html: string;
}) {
  await db.query(
    `insert into email_outbox (dedupe_key, store_id, order_id, kind, recipient, subject, html)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (dedupe_key) do nothing`,
    [input.dedupeKey, input.storeId ?? null, input.orderId ?? null, input.kind, input.recipient, input.subject, input.html]
  );

  await processEmailOutbox(1, input.dedupeKey);
}

export async function processEmailOutbox(limit = 25, dedupeKey?: string) {
  const jobs = await claimEmailJobs(limit, dedupeKey);
  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const providerMessageId = await deliver(job);
      const result = await db.query(
        `update email_outbox
            set status = 'sent',
                sent_at = now(),
                processing_started_at = null,
                last_error = null,
                provider_message_id = $3
          where id = $1 and status = 'processing' and attempt_count = $2`,
        [job.id, job.attempt_count, providerMessageId]
      );
      if (result.rowCount === 1) {
        sent++;
        logInfo("email.outbox.sent", {
          store_id: job.store_id,
          order_id: job.order_id,
          email_kind: job.kind,
          email_attempt: job.attempt_count,
        });
      }
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      const backoffSeconds = Math.min(MAX_BACKOFF_SECONDS, 60 * 2 ** Math.max(0, job.attempt_count - 1));
      await db.query(
        `update email_outbox
            set status = 'failed',
                processing_started_at = null,
                last_error = $3,
                next_attempt_at = now() + ($4 * interval '1 second')
          where id = $1 and status = 'processing' and attempt_count = $2`,
        [job.id, job.attempt_count, message.slice(0, 4000), backoffSeconds]
      );
      logError("email.outbox.failed", err, {
        store_id: job.store_id,
        order_id: job.order_id,
        email_kind: job.kind,
        email_attempt: job.attempt_count,
      });
    }
  }

  return { claimed: jobs.length, sent, failed };
}

async function claimEmailJobs(limit: number, dedupeKey?: string): Promise<EmailJob[]> {
  const { rows } = await db.query<EmailJob>(
    `with candidates as (
       select id
         from email_outbox
        where ($2::text is null or dedupe_key = $2)
          and (
            (status in ('pending','failed') and next_attempt_at <= now())
            or (status = 'processing' and processing_started_at < now() - ($3 || ' minutes')::interval)
          )
        order by next_attempt_at asc, created_at asc
        for update skip locked
        limit $1
     )
     update email_outbox e
        set status = 'processing',
            processing_started_at = now(),
            attempt_count = e.attempt_count + 1,
            last_error = null
       from candidates c
      where e.id = c.id
     returning e.id, e.dedupe_key, e.store_id, e.order_id, e.kind, e.recipient, e.subject, e.html, e.attempt_count`,
    [Math.max(1, Math.min(limit, 100)), dedupeKey ?? null, PROCESSING_LEASE_MINUTES]
  );
  return rows;
}

async function deliver(job: EmailJob) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Email delivery is not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": job.dedupe_key,
    },
    body: JSON.stringify({ from, to: [job.recipient], subject: job.subject, html: job.html }),
  });

  if (!response.ok) {
    logWarn("email.provider.rejected", {
      store_id: job.store_id,
      order_id: job.order_id,
      email_kind: job.kind,
      provider_status: response.status,
    });
    throw new Error(`Resend returned HTTP ${response.status}`);
  }

  try {
    const body = (await response.json()) as { id?: string };
    return body.id ?? null;
  } catch {
    return null;
  }
}
