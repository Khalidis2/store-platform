import type { PoolClient } from "pg";

export type LineItem = { productId: string; name: string; priceCents: number; quantity: number };

// Below this (inclusive), a product shows up in the merchant dashboard's
// "Low stock" count and gets flagged on the products page — a fixed
// platform-wide threshold rather than per-product/per-store configurable,
// same MVP-scope tradeoff as the platform fee default.
export const LOW_STOCK_THRESHOLD = 5;

export class InsufficientStockError extends Error {
  constructor(public productName: string) {
    super(`Insufficient stock for "${productName}"`);
  }
}

/**
 * Must be called inside an already-open transaction on `client`. Atomically
 * decrements each product's inventory — the `inventory >= $quantity` in the
 * WHERE clause is what makes this race-safe: two concurrent reservations for
 * the last unit of a product can't both succeed, because the second one's
 * UPDATE simply matches zero rows once the first has already taken the stock.
 * If any single item in the batch doesn't have enough stock, throws so the
 * caller can roll back the whole transaction (partial reservation of a
 * multi-item order would leave things inconsistent).
 */
export async function reserveInventory(client: PoolClient, storeId: string, items: LineItem[]) {
  for (const item of items) {
    const { rows } = await client.query(
      `update products set inventory = inventory - $1
       where id = $2 and store_id = $3 and inventory >= $1
       returning id`,
      [item.quantity, item.productId, storeId]
    );
    if (rows.length === 0) {
      throw new InsufficientStockError(item.name);
    }
  }
}

/** Restores previously reserved stock — used when a checkout session expires unpaid. */
export async function releaseInventory(client: PoolClient, storeId: string, items: LineItem[]) {
  for (const item of items) {
    await client.query(
      "update products set inventory = inventory + $1 where id = $2 and store_id = $3",
      [item.quantity, item.productId, storeId]
    );
  }
}
