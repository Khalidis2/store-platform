import { db } from "./db";
import { releaseInventory, type LineItem } from "./inventory";

/**
 * Marks an order refunded (fully or partially, based on comparing
 * `refundedAmountCents` to the order total) and records the amount.
 * Restocking only happens for a FULL refund of an order that hadn't shipped
 * yet — a partial refund could mean "discount" or "one item out of several,"
 * and without per-item refund allocation there's no reliable way to know
 * which units (if any) to put back. That's a deliberate MVP simplification;
 * this app supports one refund per order, not incremental partial refunds.
 * Idempotent: the `status in ('paid','shipped')` guard means calling this
 * again on an already-refunded order is a no-op, regardless of how many
 * times the admin action or the `charge.refunded` webhook fires.
 */
export async function applyRefund(orderId: string, storeId: string, refundedAmountCents: number) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "select status, total_cents, line_items from orders where id = $1 and store_id = $2 for update",
      [orderId, storeId]
    );
    const existing = rows[0];

    if (!existing || !["paid", "shipped"].includes(existing.status)) {
      await client.query("ROLLBACK");
      return;
    }

    const isFullRefund = refundedAmountCents >= existing.total_cents;
    const newStatus = isFullRefund ? "refunded" : "partially_refunded";

    await client.query("update orders set status = $1, refunded_amount_cents = $2 where id = $3", [
      newStatus,
      refundedAmountCents,
      orderId,
    ]);

    if (isFullRefund && existing.status === "paid") {
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

/**
 * Backstop for the (rare, but non-zero) case where Stripe's
 * `checkout.session.expired` webhook is never delivered — without this, a
 * reservation from an abandoned checkout would stay locked indefinitely.
 * Finds `pending` orders with reserved stock older than `maxAgeMinutes`
 * (should be comfortably longer than the Checkout Session expiry window)
 * and releases each one. Returns how many were released, for logging.
 */
export async function releaseStaleReservations(maxAgeMinutes: number): Promise<number> {
  const { rows: staleOrders } = await db.query(
    `select id, store_id from orders
     where status = 'pending'
       and inventory_reserved = true
       and created_at < now() - ($1 || ' minutes')::interval`,
    [maxAgeMinutes]
  );

  let released = 0;
  for (const order of staleOrders) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `update orders set status = 'expired'
         where id = $1 and status = 'pending' and inventory_reserved = true
         returning line_items`,
        [order.id]
      );

      if (rows.length > 0) {
        await releaseInventory(client, order.store_id, rows[0].line_items as LineItem[]);
        await client.query("update orders set inventory_reserved = false where id = $1", [order.id]);
        released++;
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  return released;
}
