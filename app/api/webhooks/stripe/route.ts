import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { releaseInventory, type LineItem } from "@/lib/inventory";
import { applyRefund } from "@/lib/orders";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        // Inventory was already reserved (decremented) when the Checkout
        // Session was created — this just marks the order paid. The
        // status = 'pending' guard keeps this idempotent against Stripe
        // redelivering the same event.
        await db.query(
          "update orders set status = 'paid', stripe_payment_intent_id = $1 where id = $2 and status = 'pending'",
          [session.payment_intent, orderId]
        );
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await releaseExpiredReservation(orderId);
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId) {
        const { rows } = await db.query(
          "select id, store_id from orders where stripe_payment_intent_id = $1",
          [paymentIntentId]
        );
        const order = rows[0];
        if (order) {
          await applyRefund(order.id, order.store_id);
        }
      }
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      if (account.charges_enabled && account.details_submitted) {
        await db.query("update stores set is_live = true where stripe_account_id = $1", [account.id]);
      }
      break;
    }

    default:
      break;
  }

  return Response.json({ received: true });
}

// Releases inventory that was reserved but never paid for — a buyer who
// abandons the Stripe payment page eventually triggers this, restoring the
// stock rather than leaving it locked up indefinitely.
async function releaseExpiredReservation(orderId: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `update orders set status = 'expired'
       where id = $1 and status = 'pending' and inventory_reserved = true
       returning store_id, line_items`,
      [orderId]
    );

    if (rows.length > 0) {
      const { store_id, line_items } = rows[0] as { store_id: string; line_items: LineItem[] };
      await releaseInventory(client, store_id, line_items);
      await client.query("update orders set inventory_reserved = false where id = $1", [orderId]);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
