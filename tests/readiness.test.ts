import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { checkDatabaseReadiness } from "@/lib/readiness";

const schema = fs.readFileSync(path.resolve(__dirname, "../schema.sql"), "utf8");
const readyRoute = fs.readFileSync(path.resolve(__dirname, "../app/api/ready/route.ts"), "utf8");
const healthRoute = fs.readFileSync(path.resolve(__dirname, "../app/api/health/route.ts"), "utf8");

describe("production readiness", () => {
  it("reports the dedicated test database as ready when its schema is current", async () => {
    const result = await checkDatabaseReadiness();
    expect(result.ready).toBe(true);
    expect(result.checks.every((check) => check.ok)).toBe(true);
  });

  it("keeps fresh-schema constraint names aligned with migration 014", () => {
    const names = [
      "stores_platform_fee_percent_range_check",
      "products_price_cents_nonnegative_check",
      "products_inventory_nonnegative_check",
      "orders_total_cents_nonnegative_check",
      "orders_refunded_amount_nonnegative_check",
      "orders_refunded_amount_not_over_total_check",
      "orders_status_check",
      "orders_carrier_check",
      "audit_log_actor_role_check",
    ];

    for (const name of names) expect(schema).toContain(`constraint ${name}`);
  });

  it("returns 503 when readiness checks fail and disables caching", () => {
    expect(readyRoute).toContain('status: result.ready ? 200 : 503');
    expect(readyRoute).toContain('"Cache-Control": "no-store"');
  });

  it("keeps liveness independent from database readiness", () => {
    expect(healthRoute).toContain('{ status: "ok" }');
    expect(healthRoute).not.toContain("checkDatabaseReadiness");
  });
});
