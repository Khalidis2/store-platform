import { db } from "./db";
import { releaseInventory, type LineItem } from "./inventory";
import { releaseDiscountReservation } from "./discounts";
import { sendOrderDeliveredEmail, sendOrderRefundEmail } from "./email";
import { logInfo } from "./logger";

export async function markOrderDelivered(orderId: string, storeId: string) {
  const { rows } = await db.query("update orders set status = 'delivered' where id = $1 and store_id = $2 and status = 'shipped' returning id", [orderId, storeId]);
  if (rows.length > 0) { logInfo("order.delivered", { store_id: storeId, order_id: orderId }); await sendOrderDeliveredEmail(orderId, storeId); }
}

export async function applyRefund(orderId: string, storeId: string, refundedAmountCents: number) {
  const client = await db.connect();
  let changed = false;
  let status: "refunded" | "partially_refunded" | null = null;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("select status, total_cents, line_items, has_shipped, refunded_amount_cents from orders where id = $1 and store_id = $2 for update", [orderId, storeId]);
    const existing = rows[0];
    if (!existing || !["paid", "shipped", "partially_refunded"].includes(existing.status) || refundedAmountCents <= existing.refunded_amount_cents) { await client.query("ROLLBACK"); return false; }
    const isFullRefund = refundedAmountCents >= existing.total_cents;
    status = isFullRefund ? "refunded" : "partially_refunded";
    await client.query("update orders set status = $1, refunded_amount_cents = $2 where id = $3", [status, refundedAmountCents, orderId]);
    if (isFullRefund && !existing.has_shipped) await releaseInventory(client, storeId, existing.line_items as LineItem[]);
    await client.query("COMMIT");
    changed = true;
  } catch (err) { await client.query("ROLLBACK"); throw err; }
  finally { client.release(); }

  if (changed) {
    logInfo(status === "refunded" ? "order.refund.completed" : "order.refund.partial", { store_id: storeId, order_id: orderId, refunded_amount_cents: refundedAmountCents });
    await sendOrderRefundEmail(orderId, storeId);
  }
  return changed;
}

export async function releaseStaleReservations(maxAgeMinutes: number): Promise<number> {
  const { rows: staleOrders } = await db.query(`select id, store_id from orders where status = 'pending' and inventory_reserved = true and created_at < now() - ($1 || ' minutes')::interval`, [maxAgeMinutes]);
  let released = 0;
  for (const order of staleOrders) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(`update orders set status = 'expired' where id = $1 and status = 'pending' and inventory_reserved = true returning line_items`, [order.id]);
      if (rows.length > 0) {
        await releaseInventory(client, order.store_id, rows[0].line_items as LineItem[]);
        await releaseDiscountReservation(client, order.id);
        await client.query("update orders set inventory_reserved = false where id = $1", [order.id]);
        logInfo("inventory.released", { store_id: order.store_id, order_id: order.id, reason: "stale_reservation" });
        released++;
      }
      await client.query("COMMIT");
    } catch (err) { await client.query("ROLLBACK"); throw err; }
    finally { client.release(); }
  }
  return released;
}
