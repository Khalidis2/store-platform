import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDiscountedStripeLines, calculateDiscountCents, normalizeDiscountCode } from "@/lib/discounts";

const checkoutSource = readFileSync("app/store/api/checkout/route.ts", "utf8");
const paySource = readFileSync("app/store/api/checkout/pay/route.ts", "utf8");
const webhookSource = readFileSync("app/api/webhooks/stripe/route.ts", "utf8");
const ordersSource = readFileSync("lib/orders.ts", "utf8");
const migrationSource = readFileSync("migrations/026_phase26_discount_codes.sql", "utf8");

describe("discount codes", () => {
  it("normalizes codes and rejects unsafe formats", () => {
    expect(normalizeDiscountCode(" welcome-10 ")).toBe("WELCOME-10");
    expect(normalizeDiscountCode("x" )).toBeNull();
    expect(normalizeDiscountCode("SAVE 10")).toBeNull();
  });

  it("calculates percentage and fixed discounts with subtotal caps", () => {
    expect(calculateDiscountCents(10000, "percent", 10)).toBe(1000);
    expect(calculateDiscountCents(10000, "fixed", 1500)).toBe(1500);
    expect(calculateDiscountCents(1000, "fixed", 5000)).toBe(1000);
  });

  it("distributes discount without changing the final merchandise total", () => {
    const lines = buildDiscountedStripeLines([
      { productId: "a", name: "A", priceCents: 1000, quantity: 2 },
      { productId: "b", name: "B", priceCents: 500, quantity: 1 },
    ], 1200);
    expect(lines.reduce((sum, line) => sum + line.amountCents, 0)).toBe(1300);
  });

  it("reserves usage at payment setup and redeems only after payment", () => {
    expect(paySource).toContain("reserveDiscount");
    expect(webhookSource).toContain("redeemDiscount(orderId)");
    expect(paySource).toContain("DiscountUnavailableError");
  });

  it("releases reservations on failed and expired checkouts", () => {
    expect(paySource).toContain("releaseDiscountReservation");
    expect(webhookSource).toContain("releaseDiscountReservation");
    expect(ordersSource).toContain("releaseDiscountReservation");
  });

  it("snapshots discount data and enforces the total invariant", () => {
    expect(checkoutSource).toContain("discount_cents");
    expect(migrationSource).toContain("orders_discount_snapshot_consistency_check");
    expect(migrationSource).toContain("total_cents = subtotal_cents - discount_cents + shipping_cents");
  });

  it("uses Stripe idempotency for repeated payment-session requests", () => {
    expect(paySource).toContain("idempotencyKey: `checkout-session:${order.id}`");
  });
});
