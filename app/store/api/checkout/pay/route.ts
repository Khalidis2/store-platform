import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";
import { stripe } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/get-base-url";

// How much the platform keeps from each order. Adjust as your pricing model
// firms up — this is the one number that defines your take rate.
const PLATFORM_FEE_PERCENT = 5;

type LineItem = { name: string; priceCents: number; quantity: number };

export async function POST(req: Request) {
  const store = await getCurrentStore();
  if (!store) {
    return Response.json({ error: "Store not found" }, { status: 404 });
  }

  if (!store.is_live || !store.stripe_account_id) {
    return Response.json(
      { error: "This store isn't set up to accept payments yet" },
      { status: 400 }
    );
  }

  const { orderId } = await req.json();
  const { rows } = await db.query(
    "select * from orders where id = $1 and store_id = $2",
    [orderId, store.id]
  );
  const order = rows[0];

  if (!order) {
    return Response.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "pending") {
    return Response.json({ error: "Order already processed" }, { status: 400 });
  }

  const lineItems = order.line_items as LineItem[];
  const applicationFeeAmount = Math.round(order.total_cents * (PLATFORM_FEE_PERCENT / 100));
  const baseUrl = getBaseUrl();

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
    success_url: `${baseUrl}/order-confirmation/${order.id}`,
    cancel_url: `${baseUrl}/checkout`,
  });

  return Response.json({ url: session.url });
}
