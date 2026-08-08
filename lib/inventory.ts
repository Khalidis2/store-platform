import type { PoolClient } from "pg";

export type LineItem = { productId: string; name: string; priceCents: number; quantity: number };

export const LOW_STOCK_THRESHOLD = 5;

export class InsufficientStockError extends Error {
  constructor(public productName: string) {
    super(`Insufficient stock for "${productName}"`);
  }
}

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

export async function releaseInventory(client: PoolClient, storeId: string, items: LineItem[]) {
  for (const item of items) {
    await client.query(
      `update products
          set inventory = inventory + $1,
              low_stock_alerted_at = case
                when inventory + $1 > $4 then null
                else low_stock_alerted_at
              end
        where id = $2 and store_id = $3`,
      [item.quantity, item.productId, storeId, LOW_STOCK_THRESHOLD]
    );
  }
}
