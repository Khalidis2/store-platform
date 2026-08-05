import { describe, it, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { reserveInventory, releaseInventory, InsufficientStockError } from "@/lib/inventory";
import { createTestStore, createTestProduct, getProductInventory, cleanupStore } from "./db-helpers";

describe("inventory reservation", () => {
  let storeId: string;

  afterEach(async () => {
    if (storeId) await cleanupStore(storeId);
  });

  it("decrements inventory when stock is sufficient", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 5);

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await reserveInventory(client, storeId, [
        { productId, name: "p", priceCents: 1000, quantity: 3 },
      ]);
      await client.query("COMMIT");
    } finally {
      client.release();
    }

    expect(await getProductInventory(productId)).toBe(2);
  });

  it("throws InsufficientStockError and does not decrement when stock is too low", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 1);

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await expect(
        reserveInventory(client, storeId, [{ productId, name: "p", priceCents: 1000, quantity: 2 }])
      ).rejects.toThrow(InsufficientStockError);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    expect(await getProductInventory(productId)).toBe(1);
  });

  it("rolls back an earlier item's decrement when a later item in the same order fails", async () => {
    storeId = await createTestStore();
    const plentiful = await createTestProduct(storeId, 10);
    const scarce = await createTestProduct(storeId, 1);

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await expect(
        reserveInventory(client, storeId, [
          { productId: plentiful, name: "plentiful", priceCents: 1000, quantity: 1 },
          { productId: scarce, name: "scarce", priceCents: 1000, quantity: 2 },
        ])
      ).rejects.toThrow(InsufficientStockError);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    // The plentiful item was decremented first, inside the same transaction
    // reserveInventory's caller controls — rolling that transaction back
    // must undo it too, not just leave the failed item untouched.
    expect(await getProductInventory(plentiful)).toBe(10);
    expect(await getProductInventory(scarce)).toBe(1);
  });

  it("lets only one of two concurrent requests take the last unit", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 1);

    async function attempt() {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await reserveInventory(client, storeId, [
          { productId, name: "p", priceCents: 1000, quantity: 1 },
        ]);
        await client.query("COMMIT");
        return "success";
      } catch (err) {
        await client.query("ROLLBACK");
        if (err instanceof InsufficientStockError) return "insufficient";
        throw err;
      } finally {
        client.release();
      }
    }

    const results = await Promise.all([attempt(), attempt()]);

    expect(results.filter((r) => r === "success")).toHaveLength(1);
    expect(results.filter((r) => r === "insufficient")).toHaveLength(1);
    expect(await getProductInventory(productId)).toBe(0);
  });

  it("releaseInventory restores previously reserved stock", async () => {
    storeId = await createTestStore();
    const productId = await createTestProduct(storeId, 5);

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await reserveInventory(client, storeId, [
        { productId, name: "p", priceCents: 1000, quantity: 3 },
      ]);
      await releaseInventory(client, storeId, [
        { productId, name: "p", priceCents: 1000, quantity: 3 },
      ]);
      await client.query("COMMIT");
    } finally {
      client.release();
    }

    expect(await getProductInventory(productId)).toBe(5);
  });
});
