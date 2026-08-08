import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { analyticsRangeSql, parseAnalyticsRange } from "../lib/analytics";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("commerce analytics", () => {
  it("normalizes analytics ranges", () => {
    expect(parseAnalyticsRange("today")).toBe("today");
    expect(parseAnalyticsRange("7d")).toBe("7d");
    expect(parseAnalyticsRange("30d")).toBe("30d");
    expect(parseAnalyticsRange("all")).toBe("all");
    expect(parseAnalyticsRange("invalid")).toBe("30d");
  });

  it("uses Dubai day boundaries for today", () => {
    expect(analyticsRangeSql("today")).toContain("Asia/Dubai");
    expect(analyticsRangeSql("7d")).toContain("interval '7 days'");
    expect(analyticsRangeSql("30d")).toContain("interval '30 days'");
  });

  it("snapshots checkout fees before creating Stripe checkout", () => {
    const source = read("app/store/api/checkout/pay/route.ts");
    expect(source).toContain("platform_fee_percent_snapshot");
    expect(source).toContain("platform_fee_cents");
    expect(source.indexOf("platform_fee_percent_snapshot")).toBeLessThan(source.indexOf("stripe.checkout.sessions.create"));
  });

  it("records realized payment time from the Stripe webhook", () => {
    const source = read("app/api/webhooks/stripe/route.ts");
    expect(source).toContain("paid_at = coalesce(paid_at, now())");
  });

  it("keeps legacy fee data honest instead of inventing snapshots", () => {
    const migration = read("migrations/024_phase25_analytics.sql");
    expect(migration).toContain("set paid_at = created_at");
    expect(migration).not.toContain("set platform_fee_cents =");
  });

  it("requires analytics schema in readiness", () => {
    const source = read("lib/readiness.ts");
    expect(source).toContain('["orders", "paid_at"]');
    expect(source).toContain('["orders", "platform_fee_cents"]');
    expect(source).toContain("orders_platform_fee_snapshot_pair_check");
  });

  it("surfaces analytics in merchant and platform dashboards", () => {
    const merchant = read("app/store/admin/page.tsx");
    const platform = read("app/platform-admin/(dashboard)/page.tsx");
    expect(merchant).toContain("Sales analytics");
    expect(merchant).toContain("Proceeds before Stripe fees");
    expect(platform).toContain("Commerce analytics");
    expect(platform).toContain("Platform revenue");
  });
});
