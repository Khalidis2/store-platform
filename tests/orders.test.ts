import { describe, it, expect, afterEach } from "vitest";
import { applyRefund, markOrderDelivered, releaseStaleReservations } from "@/lib/orders";
import {
  createTestStore,
  createTestProduct,
  createTestOrder,
  getOrder,
  getProductInventory,
  cleanupStore,
} from "./db-helpers";

describe("applyRefund", () => {
  let storeId: string;

  afterEach(async () => {
    if (storeId) await cleanupStore(storeId);
  });

  it("partial refund sets status to partially_refunded and records the amount", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 5);
    const orderId = await createTestOrder(
      storeId,
      [{ productId, name: "p", priceCents: 5000, quantity: 1 }],
      { status: "paid", totalCents: 5000 }
    );

    await applyRefund(orderId, storeId, 2000);

    const order = await getOrder(orderId);
    expect(order.status).toBe("partially_refunded");
    expect(order.refunded_amount_cents).toBe(2000);
  });

  it("refunding the full amount sets status to refunded", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 5);
    const orderId = await createTestOrder(
      storeId,
      [{ productId, name: "p", priceCents: 5000, quantity: 1 }],
      { status: "paid", totalCents: 5000 }
    );

    await applyRefund(orderId, storeId, 5000);

    const order = await getOrder(orderId);
    expect(order.status).toBe("refunded");
  });

  it("restocks inventory on full refund only when the order never shipped", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 5);
    const orderId = await createTestOrder(
      storeId,
      [{ productId, name: "p", priceCents: 5000, quantity: 2 }],
      { status: "paid", totalCents: 5000, hasShipped: false }
    );

    await applyRefund(orderId, storeId, 5000);

    // Order reservation isn't simulated here (createTestOrder doesn't call
    // reserveInventory), so this asserts the *increment* happened relative
    // to the starting value, not an absolute number.
    expect(await getProductInventory(productId)).toBe(7);
  });

  it("does not restock inventory on full refund when the order already shipped", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 5);
    const orderId = await createTestOrder(
      storeId,
      [{ productId, name: "p", priceCents: 5000, quantity: 2 }],
      { status: "shipped", totalCents: 5000, hasShipped: true }
    );

    await applyRefund(orderId, storeId, 5000);

    expect(await getProductInventory(productId)).toBe(5);
  });

  it("is idempotent — redelivering the same cumulative amount after full refund is a no-op", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 5);
    const orderId = await createTestOrder(
      storeId,
      [{ productId, name: "p", priceCents: 5000, quantity: 2 }],
      { status: "paid", totalCents: 5000, hasShipped: false }
    );

    await applyRefund(orderId, storeId, 5000);
    const inventoryAfterFirst = await getProductInventory(productId);

    // Simulates a redelivered charge.refunded webhook arriving after the
    // order already reached "refunded" via the direct admin action.
    await applyRefund(orderId, storeId, 5000);

    expect(await getProductInventory(productId)).toBe(inventoryAfterFirst);
    expect((await getOrder(orderId)).status).toBe("refunded");
  });

  it("does nothing for an order that isn't paid/shipped/partially_refunded", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 5);
    const orderId = await createTestOrder(
      storeId,
      [{ productId, name: "p", priceCents: 5000, quantity: 1 }],
      { status: "pending", totalCents: 5000 }
    );

    await applyRefund(orderId, storeId, 5000);

    expect((await getOrder(orderId)).status).toBe("pending");
  });
});

describe("markOrderDelivered", () => {
  let storeId: string;

  afterEach(async () => {
    if (storeId) await cleanupStore(storeId);
  });

  it("transitions a shipped order to delivered", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 5);
    const orderId = await createTestOrder(
      storeId,
      [{ productId, name: "p", priceCents: 5000, quantity: 1 }],
      { status: "shipped", totalCents: 5000 }
    );

    await markOrderDelivered(orderId, storeId);

    expect((await getOrder(orderId)).status).toBe("delivered");
  });

  it("does not transition an order that hasn't shipped", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 5);
    const orderId = await createTestOrder(
      storeId,
      [{ productId, name: "p", priceCents: 5000, quantity: 1 }],
      { status: "paid", totalCents: 5000 }
    );

    await markOrderDelivered(orderId, storeId);

    expect((await getOrder(orderId)).status).toBe("paid");
  });
});

describe("releaseStaleReservations", () => {
  let storeId: string;

  afterEach(async () => {
    if (storeId) await cleanupStore(storeId);
  });

  it("expires old pending+reserved orders and restores their inventory", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 3);
    const staleOrderId = await createTestOrder(
      storeId,
      [{ productId, name: "p", priceCents: 5000, quantity: 2 }],
      { status: "pending", totalCents: 5000, createdAt: new Date(Date.now() - 60 * 60 * 1000) }
    );

    const released = await releaseStaleReservations(45);

    expect(released).toBeGreaterThanOrEqual(1);
    expect((await getOrder(staleOrderId)).status).toBe("expired");
    expect((await getOrder(staleOrderId)).inventory_reserved).toBe(false);
    expect(await getProductInventory(productId)).toBe(5);
  });

  it("leaves recent pending orders alone", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 3);
    const recentOrderId = await createTestOrder(
      storeId,
      [{ productId, name: "p", priceCents: 5000, quantity: 2 }],
      { status: "pending", totalCents: 5000, createdAt: new Date() }
    );

    await releaseStaleReservations(45);

    expect((await getOrder(recentOrderId)).status).toBe("pending");
    expect(await getProductInventory(productId)).toBe(3);
  });
});
