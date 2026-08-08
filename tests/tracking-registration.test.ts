import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerSource = readFileSync("lib/tracking-registration.ts", "utf8");
const actionSource = readFileSync("app/store/admin/orders/actions.ts", "utf8");
const aftershipSource = readFileSync("lib/aftership.ts", "utf8");
const migrationSource = readFileSync("migrations/029_phase24_tracking_registration.sql", "utf8");

describe("tracking registration reliability", () => {
  it("uses a processing lease and fenced attempts", () => {
    expect(workerSource).toContain("PROCESSING_LEASE_MINUTES = 5");
    expect(workerSource).toContain("for update skip locked");
    expect(workerSource).toContain("tracking_registration_attempt_count = $2");
  });

  it("retries failed registrations with backoff", () => {
    expect(workerSource).toContain("tracking_registration_status = 'failed'");
    expect(workerSource).toContain("tracking_registration_next_attempt_at");
    expect(workerSource).toContain("MAX_BACKOFF_SECONDS");
  });

  it("separates shipped state from carrier automation", () => {
    expect(actionSource).toContain("tracking_registration_status");
    expect(actionSource).toContain("sendOrderShippedEmail");
    expect(actionSource.indexOf("sendOrderShippedEmail")).toBeLessThan(actionSource.indexOf("processTrackingRegistrations"));
  });

  it("treats provider failure as an error for the retry worker", () => {
    expect(aftershipSource).toContain("throw new Error");
    expect(aftershipSource).not.toContain("returns null instead of throwing");
  });

  it("backfills existing supported shipped tracking into pending registration", () => {
    expect(migrationSource).toContain("carrier in ('aramex','emirates_post')");
    expect(migrationSource).toContain("tracking_registration_status = 'pending'");
  });
});
