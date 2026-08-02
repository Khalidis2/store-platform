import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";
import { stripe } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/get-base-url";
import { reserveInventory, releaseInventory, InsufficientStockError, type LineItem } from "@/lib/inventory";

// Falls back to this if a store doesn't have platform_fee_percent set —
// see the platform admin panel (app/platform-admin/) to override per store.
const DEFAULT_PLATFORM_FEE_PERCENT = 5;
// Stripe requires Checkout Session expiry between 30 minutes and 24 hours
// from creation. Kept short so abandoned reservations release quickly.
const SESSION_EXPIRY_MINUTES = 31;

export async function POST(req: Request) {
  const store = await getCurrentStore();
  if (!store) return Response.json({ error: "Store not found" }, { status: 404 });

  if (!store.is_live || !store.stripe_account_id) {
    return Response.json({ error: "This store isn't set up to accept payments yet" }, { status: 400 });
  }

  const { orderId } = await req.json();

  const client = await db.connect();
  let order;
  try {
    await client.query("BEGIN");

    // FOR UPDATE locks this order row until COMMIT/ROLLBACK — if two
    // requests hit this endpoint for the same order concurrently (e.g. a
    // double-click), the second one waits here rather than racing the first.
    const { rows } = await client.query(
      "select * from orders where id = $1 and store_id = $2 for update",
      [orderId, store.id]
    );
    order = rows[0];

    if (!order) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status !== "pending") {
      await client.query("ROLLBACK");
      return Response.json({ error: "Order already processed" }, { status: 400 });
    }

    // If a previous call already reserved stock for this order (e.g. the
    // Stripe API call failed after reservation and this is a retry, or the
    // flag is already set for some other reason), don't reserve twice.
    if (!order.inventory_reserved) {
      try {
        await reserveInventory(client, store.id, order.line_items as LineItem[]);
      } catch (err) {
        await client.query("ROLLBACK");
        if (err instanceof InsufficientStockError) {
          return Response.json({ error: err.message }, { status: 409 });
        }
        throw err;
      }
      await client.query("update orders set inventory_reserved = true where id = $1", [order.id]);
    }

    await client.query("COMMIT");
  } finally {
    client.release();
  }

  const lineItems = order.line_items as LineItem[];
  const feePercent = store.platform_fee_percent ?? DEFAULT_PLATFORM_FEE_PERCENT;
  const applicationFeeAmount = Math.round(order.total_cents * (feePercent / 100));
  const baseUrl = getBaseUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: order.customer_email,
      line_items: lineItems.map((item) => ({
        price_data: {
          currency: "aed",
          product_data: { name: item.name },
          unit_amount: item.priceCents,
        },
        quantity: item.quantity,
      })),
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: { destination: store.stripe_account_id },
      },
      metadata: { orderId: order.id, storeId: store.id },
      expires_at: Math.floor(Date.now() / 1000) + SESSION_EXPIRY_MINUTES * 60,
      success_url: `${baseUrl}/order-confirmation/${order.id}`,
      cancel_url: `${baseUrl}/checkout`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    // Stripe session creation failed after stock was already reserved —
    // release it immediately rather than leaving it locked with no Checkout
    // Session to eventually expire and trigger the release webhook.
    const releaseClient = await db.connect();
    try {
      await releaseClient.query("BEGIN");
      await releaseInventory(releaseClient, store.id, lineItems);
      await releaseClient.query("update orders set inventory_reserved = false where id = $1", [order.id]);
      await releaseClient.query("COMMIT");
    } catch {
      await releaseClient.query("ROLLBACK");
    } finally {
      releaseClient.release();
    }
    return Response.json({ error: "Payment setup failed, please try again" }, { status: 500 });
  }
}
