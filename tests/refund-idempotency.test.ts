import { afterEach, describe, expect, it } from "vitest";
import { applyRefund } from "@/lib/orders";
import {
  cleanupStore,
  createTestOrder,
  createTestProduct,
  createTestStore,
  getOrder,
  getProductInventory,
} from "./db-helpers";

describe("partial refund idempotency", () => {
  let storeId: string;

  afterEach(async () => {
    if (storeId) await cleanupStore(storeId);
  });

  it("ignores a redelivered partial-refund cumulative amount", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 5);
    const orderId = await createTestOrder(
      storeId,
      [{ productId, name: "p", priceCents: 5000, quantity: 1 }],
      { status: "paid", totalCents: 5000 }
    );

    expect(await applyRefund(orderId, storeId, 2000)).toBe(true);
    expect(await applyRefund(orderId, storeId, 2000)).toBe(false);

    const order = await getOrder(orderId);
    expect(order.status).toBe("partially_refunded");
    expect(order.refunded_amount_cents).toBe(2000);
    expect(await getProductInventory(productId)).toBe(5);
  });
});
