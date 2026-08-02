import { db } from "./db";
import { releaseInventory, type LineItem } from "./inventory";

/**
 * Marks an order refunded. Restores inventory only if the order hadn't
 * shipped yet — once shipped, restocking is a manual merchant decision
 * (the item has physically left; handling actual returns is out of scope
 * here). Idempotent: calling this again on an already-refunded order is a
 * no-op, which matters because both the admin refund action and the
 * `charge.refunded` webhook call this, and either could fire more than once
 * for the same order.
 */
export async function applyRefund(orderId: string, storeId: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "select status, line_items from orders where id = $1 and store_id = $2 for update",
      [orderId, storeId]
    );
    const existing = rows[0];

    if (!existing || !["paid", "shipped"].includes(existing.status)) {
      await client.query("ROLLBACK");
      return;
    }

    await client.query("update orders set status = 'refunded' where id = $1", [orderId]);

    if (existing.status === "paid") {
      await releaseInventory(client, storeId, existing.line_items as LineItem[]);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
