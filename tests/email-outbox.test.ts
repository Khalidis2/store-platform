import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const outboxSource = readFileSync("lib/email-outbox.ts", "utf8");
const emailSource = readFileSync("lib/email.ts", "utf8");
const lowStockEmailSource = readFileSync("lib/low-stock-email.ts", "utf8");
const cronSource = readFileSync("app/api/cron/email-outbox/route.ts", "utf8");
const migrationSource = readFileSync("migrations/028_phase24_email_outbox.sql", "utf8");

describe("durable email outbox", () => {
  it("deduplicates business events in postgres and at Resend", () => {
    expect(outboxSource).toContain("on conflict (dedupe_key) do nothing");
    expect(outboxSource).toContain('"Idempotency-Key": job.dedupe_key');
    expect(emailSource).toContain("dedupeKey");
    expect(lowStockEmailSource).toContain("dedupeKey");
  });

  it("retries failed and stale processing jobs", () => {
    expect(outboxSource).toContain("status in ('pending','failed')");
    expect(outboxSource).toContain("processing_started_at < now()");
    expect(outboxSource).toContain("next_attempt_at");
  });

  it("uses an attempt fence when finalizing delivery", () => {
    expect(outboxSource).toContain("attempt_count = $2");
    expect(outboxSource).toContain("status = 'processing'");
  });

  it("protects the retry endpoint with CRON_SECRET", () => {
    expect(cronSource).toContain("CRON_SECRET");
    expect(cronSource).toContain("Bearer ${secret}");
  });

  it("enforces outbox state invariants in postgres", () => {
    expect(migrationSource).toContain("email_outbox_status_check");
    expect(migrationSource).toContain("email_outbox_processing_lease_check");
    expect(migrationSource).toContain("email_outbox_sent_at_check");
  });
});
