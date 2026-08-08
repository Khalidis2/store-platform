import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { calculateShippingCents } from "@/lib/shipping";

const checkout = fs.readFileSync(path.resolve(__dirname, "../app/store/api/checkout/route.ts"), "utf8");
const payment = fs.readFileSync(path.resolve(__dirname, "../app/store/api/checkout/pay/route.ts"), "utf8");
const migration = fs.readFileSync(path.resolve(__dirname, "../migrations/021_phase25_shipping.sql"), "utf8");

describe("calculateShippingCents", () => {
  it("charges the flat fee below the free-delivery threshold", () => {
    expect(calculateShippingCents(9_999, 1_500, 10_000)).toBe(1_500);
  });

  it("makes delivery free at and above the threshold", () => {
    expect(calculateShippingCents(10_000, 1_500, 10_000)).toBe(0);
    expect(calculateShippingCents(15_000, 1_500, 10_000)).toBe(0);
  });

  it("charges the flat fee when no threshold is configured", () => {
    expect(calculateShippingCents(50_000, 2_000, null)).toBe(2_000);
  });
});

describe("shipping order contract", () => {
  it("snapshots subtotal, shipping, and total on order creation", () => {
    expect(checkout).toContain("subtotal_cents, shipping_cents, total_cents");
    expect(checkout).toContain("calculateShippingCents");
  });

  it("includes paid delivery as a Stripe Checkout line item", () => {
    expect(payment).toContain('product_data: { name: "Delivery" }');
    expect(payment).toContain("order.shipping_cents");
  });

  it("enforces total equals subtotal plus shipping in Postgres", () => {
    expect(migration).toContain("orders_total_matches_components_check");
    expect(migration).toContain("total_cents = subtotal_cents + shipping_cents");
  });
});
