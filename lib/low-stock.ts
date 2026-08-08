import { db } from "./db";
import { LOW_STOCK_THRESHOLD, type LineItem } from "./inventory";

export type LowStockAlert = {
  productId: string;
  name: string;
  inventory: number;
  alertedAt: string;
};

export async function claimLowStockAlerts(storeId: string, items: LineItem[]): Promise<LowStockAlert[]> {
  const alerts: LowStockAlert[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.productId)) continue;
    seen.add(item.productId);

    const { rows } = await db.query<{ id: string; name: string; inventory: number; low_stock_alerted_at: string }>(
      `update products
          set low_stock_alerted_at = now()
        where id = $1
          and store_id = $2
          and status = 'active'
          and inventory <= $3
          and low_stock_alerted_at is null
      returning id, name, inventory, low_stock_alerted_at`,
      [item.productId, storeId, LOW_STOCK_THRESHOLD]
    );

    if (rows[0]) {
      alerts.push({
        productId: rows[0].id,
        name: rows[0].name,
        inventory: rows[0].inventory,
        alertedAt: rows[0].low_stock_alerted_at,
      });
    }
  }

  return alerts;
}
