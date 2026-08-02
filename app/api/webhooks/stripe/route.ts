import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

type LineItem = { productId: string; name: string; priceCents: number; quantity: number };

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
        await markPaidAndDecrementInventory(orderId, session.payment_intent as string);
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

// Wrapped in a transaction, and gated on status = 'pending' in the UPDATE
// itself, so this is safe to run more than once — Stripe can and does
// redeliver webhook events, and without this guard a retry would decrement
// inventory a second time for the same order.
async function markPaidAndDecrementInventory(orderId: string, paymentIntentId: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `update orders set status = 'paid', stripe_payment_intent_id = $1
       where id = $2 and status = 'pending'
       returning store_id, line_items`,
      [paymentIntentId, orderId]
    );

    if (rows.length > 0) {
      const { store_id, line_items } = rows[0] as { store_id: string; line_items: LineItem[] };
      for (const item of line_items) {
        await client.query(
          "update products set inventory = greatest(inventory - $1, 0) where id = $2 and store_id = $3",
          [item.quantity, item.productId, store_id]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
