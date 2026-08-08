import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const inventorySource = readFileSync("lib/inventory.ts", "utf8");
const lowStockSource = readFileSync("lib/low-stock.ts", "utf8");
const webhookSource = readFileSync("app/api/webhooks/stripe/route.ts", "utf8");
const productActionsSource = readFileSync("app/store/admin/products/actions.ts", "utf8");
const emailSource = readFileSync("lib/email.ts", "utf8");
const migrationSource = readFileSync("migrations/025_phase26_low_stock_alerts.sql", "utf8");

 describe("low stock alerts", () => {
  it("uses the shared low-stock threshold", () => {
    expect(lowStockSource).toContain("LOW_STOCK_THRESHOLD");
    expect(inventorySource).toContain("export const LOW_STOCK_THRESHOLD = 5");
  });

  it("claims each low-stock product atomically only once", () => {
    expect(lowStockSource).toContain("low_stock_alerted_at is null");
    expect(lowStockSource).toContain("set low_stock_alerted_at = now()");
    expect(lowStockSource).toContain("status = 'active'");
  });

  it("alerts after successful payment rather than checkout reservation", () => {
    expect(webhookSource).toContain("claimLowStockAlerts");
    expect(webhookSource).toContain("sendLowStockAlertEmail");
    expect(webhookSource.indexOf("status = 'paid'")).toBeLessThan(webhookSource.indexOf("claimLowStockAlerts"));
  });

  it("resets the latch when inventory is replenished above the threshold", () => {
    expect(inventorySource).toContain("low_stock_alerted_at = case");
    expect(productActionsSource).toContain("low_stock_alerted_at");
  });

  it("does not blast alerts for products already low at migration time", () => {
    expect(migrationSource).toContain("where inventory <= 5");
    expect(migrationSource).toContain("coalesce(low_stock_alerted_at, now())");
  });

  it("uses the merchant notification email", () => {
    expect(emailSource).toContain("sendLowStockAlertEmail");
    expect(emailSource).toContain("notification_email");
    expect(emailSource).toContain("merchant_low_stock");
  });
});
