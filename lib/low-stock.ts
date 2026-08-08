import { db } from "./db";
import { LOW_STOCK_THRESHOLD, type LineItem } from "./inventory";

export type LowStockAlert = {
  productId: string;
  name: string;
  inventory: number;
};

export async function claimLowStockAlerts(storeId: string, items: LineItem[]): Promise<LowStockAlert[]> {
  const alerts: LowStockAlert[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.productId)) continue;
    seen.add(item.productId);

    const { rows } = await db.query<{ id: string; name: string; inventory: number }>(
      `update products
          set low_stock_alerted_at = now()
        where id = $1
          and store_id = $2
          and status = 'active'
          and inventory <= $3
          and low_stock_alerted_at is null
      returning id, name, inventory`,
      [item.productId, storeId, LOW_STOCK_THRESHOLD]
    );

    if (rows[0]) {
      alerts.push({ productId: rows[0].id, name: rows[0].name, inventory: rows[0].inventory });
    }
  }

  return alerts;
}
