import { db } from "./db";
import { releaseInventory, type LineItem } from "./inventory";

/**
 * Marks a shipped order delivered. Shared between the merchant-facing
 * "Mark delivered" action and the AfterShip webhook, so an order can be
 * confirmed delivered either manually or automatically once the carrier
 * reports it.
 */
export async function markOrderDelivered(orderId: string, storeId: string) {
  await db.query(
    "update orders set status = 'delivered' where id = $1 and store_id = $2 and status = 'shipped'",
    [orderId, storeId]
  );
}

/**
 * Marks an order refunded (fully or partially, based on comparing the
 * cumulative `refundedAmountCents` to the order total) and records the
 * amount. Supports multiple incremental partial refunds on the same order —
 * the caller passes the running total refunded so far, not just this
 * increment.
 *
 * Restocking only happens on the refund that brings the order to FULLY
 * refunded, and only if the order never shipped — checked via the
 * dedicated `has_shipped` flag rather than `status`, since `status` gets
 * overwritten by refund states and would otherwise lose track of whether an
 * order shipped once it's already partially refunded.
 *
 * Idempotent: the `status in (...)` guard means calling this again with the
 * same cumulative amount (e.g. a redelivered webhook) is a no-op once the
 * order has already reached that state.
 */
export async function applyRefund(orderId: string, storeId: string, refundedAmountCents: number) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "select status, total_cents, line_items, has_shipped from orders where id = $1 and store_id = $2 for update",
      [orderId, storeId]
    );
    const existing = rows[0];

    if (!existing || !["paid", "shipped", "partially_refunded"].includes(existing.status)) {
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

    if (isFullRefund && !existing.has_shipped) {
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
