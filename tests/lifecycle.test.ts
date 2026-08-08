import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const migration = fs.readFileSync(path.resolve(__dirname, "../migrations/020_phase25_lifecycle.sql"), "utf8");
const checkout = fs.readFileSync(path.resolve(__dirname, "../app/store/api/checkout/route.ts"), "utf8");
const pay = fs.readFileSync(path.resolve(__dirname, "../app/store/api/checkout/pay/route.ts"), "utf8");

describe("Phase 25 lifecycle", () => {
  it("defines constrained store and product lifecycle states", () => {
    expect(migration).toContain("'draft', 'active', 'suspended', 'closed'");
    expect(migration).toContain("'draft', 'active', 'archived'");
  });

  it("blocks order creation for non-active stores and products", () => {
    expect(checkout).toContain('store.status !== "active"');
    expect(checkout).toContain("status = 'active'");
  });

  it("blocks payment session creation for non-active stores", () => {
    expect(pay).toContain('store.status !== "active"');
    expect(pay).toContain("!store.is_live || !store.stripe_account_id");
  });
});
