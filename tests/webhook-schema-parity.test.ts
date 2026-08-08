import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const initialMigration = readFileSync("migrations/017_phase24_webhook_events.sql", "utf8");
const leaseMigration = readFileSync("migrations/027_phase24_webhook_processing_lease.sql", "utf8");
const schema = readFileSync("schema.sql", "utf8");
const readiness = readFileSync("lib/readiness.ts", "utf8");

const CONSTRAINTS = [
  "webhook_events_provider_check",
  "webhook_events_status_check",
  "webhook_events_attempt_count_positive_check",
  "webhook_events_processing_lease_check",
];

describe("webhook schema parity", () => {
  it("keeps migrated and fresh schemas on the same webhook status model", () => {
    for (const status of ["received", "processing", "processed", "failed"]) {
      expect(initialMigration).toContain(`'${status}'`);
      expect(schema).toContain(`'${status}'`);
    }
  });

  it("requires the processing lease in migration, fresh schema, and readiness", () => {
    expect(leaseMigration).toContain("processing_started_at");
    expect(schema).toContain("processing_started_at timestamptz");
    expect(readiness).toContain('["webhook_events","processing_started_at"]');
    for (const constraint of CONSTRAINTS) {
      expect(schema).toContain(constraint);
      expect(readiness).toContain(constraint);
    }
  });
});
