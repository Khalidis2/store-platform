import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";
import { stripe } from "@/lib/stripe";
import { getBaseUrl } from "@/lib/get-base-url";
import { reserveInventory, releaseInventory, InsufficientStockError, type LineItem } from "@/lib/inventory";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getRequestId, logError, logInfo, logWarn } from "@/lib/logger";
import { buildDiscountedStripeLines, DiscountUnavailableError, releaseDiscountReservation, reserveDiscount } from "@/lib/discounts";

const DEFAULT_PLATFORM_FEE_PERCENT = 5;
const SESSION_EXPIRY_MINUTES = 31;

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const store = await getCurrentStore();
  if (!store) return Response.json({ error: "Store not found" }, { status: 404 });
  if (store.status !== "active") return Response.json({ error: "This store is not accepting payments" }, { status: 403 });
  if (!store.is_live || !store.stripe_account_id) return Response.json({ error: "This store isn't set up to accept payments yet" }, { status: 400 });

  const { orderId } = await req.json();
  if (!orderId || typeof orderId !== "string") return Response.json({ error: "Order ID is required" }, { status: 400 });

  const ip = getClientIp(req);
  const [storeLimit, orderLimit] = await Promise.all([
    rateLimit({ scope: "checkout:pay:store", subject: `${store.id}:${ip}`, limit: 20, windowSeconds: 600 }),
    rateLimit({ scope: "checkout:pay:order", subject: `${store.id}:${orderId}:${ip}`, limit: 5, windowSeconds: 600 }),
  ]);
  if (!storeLimit.allowed || !orderLimit.allowed) {
    logWarn("checkout.payment.rate_limited", { request_id: requestId, store_id: store.id, order_id: orderId });
    return rateLimitResponse(!storeLimit.allowed ? storeLimit : orderLimit);
  }

  const configuredFeePercent = store.platform_fee_percent ?? DEFAULT_PLATFORM_FEE_PERCENT;
  const client = await db.connect();
  let order: any;
  let applicationFeeAmount = 0;
  let feePercentSnapshot = configuredFeePercent;

  try {
    await client.query("BEGIN");
    const { rows } = await client.query("select * from orders where id = $1 and store_id = $2 for update", [orderId, store.id]);
    order = rows[0];
    if (!order) { await client.query("ROLLBACK"); return Response.json({ error: "Order not found" }, { status: 404 }); }
    if (order.status !== "pending") { await client.query("ROLLBACK"); return Response.json({ error: "Order already processed" }, { status: 400 }); }

    if (order.discount_id) {
      try { await reserveDiscount(client, order.id, store.id, order.discount_id); }
      catch (err) {
        await client.query("ROLLBACK");
        if (err instanceof DiscountUnavailableError) return Response.json({ error: err.message }, { status: 409 });
        throw err;
      }
    }

    feePercentSnapshot = order.platform_fee_percent_snapshot ?? configuredFeePercent;
    applicationFeeAmount = order.platform_fee_cents ?? Math.round(order.total_cents * (feePercentSnapshot / 100));
    if (order.platform_fee_cents == null) {
      await client.query("update orders set platform_fee_percent_snapshot = $1, platform_fee_cents = $2 where id = $3", [feePercentSnapshot, applicationFeeAmount, order.id]);
    }

    if (!order.inventory_reserved) {
      try { await reserveInventory(client, store.id, order.line_items as LineItem[]); }
      catch (err) {
        await client.query("ROLLBACK");
        if (err instanceof InsufficientStockError) return Response.json({ error: err.message }, { status: 409 });
        throw err;
      }
      await client.query("update orders set inventory_reserved = true where id = $1", [order.id]);
      logInfo("inventory.reserved", { request_id: requestId, store_id: store.id, order_id: order.id });
    }
    await client.query("COMMIT");
  } finally { client.release(); }

  const lineItems = order.line_items as LineItem[];
  const baseUrl = await getBaseUrl();
  const discountedLines = buildDiscountedStripeLines(lineItems, order.discount_cents ?? 0);
  const stripeLineItems = [
    ...discountedLines.map((item) => ({ price_data: { currency: "aed" as const, product_data: { name: item.name }, unit_amount: item.amountCents }, quantity: 1 })),
    ...(order.shipping_cents > 0 ? [{ price_data: { currency: "aed" as const, product_data: { name: "Delivery" }, unit_amount: order.shipping_cents }, quantity: 1 }] : []),
  ];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: order.customer_email,
      line_items: stripeLineItems,
      ...(order.total_cents > 0 ? { payment_intent_data: { application_fee_amount: applicationFeeAmount, transfer_data: { destination: store.stripe_account_id } } } : {}),
      metadata: { orderId: order.id, storeId: store.id },
      expires_at: Math.floor(Date.now() / 1000) + SESSION_EXPIRY_MINUTES * 60,
      success_url: `${baseUrl}/order-confirmation/${order.id}`,
      cancel_url: `${baseUrl}/checkout`,
    }, { idempotencyKey: `checkout-session:${order.id}` });

    logInfo("checkout.session.created", { request_id: requestId, store_id: store.id, order_id: order.id, subtotal_cents: order.subtotal_cents, discount_cents: order.discount_cents ?? 0, shipping_cents: order.shipping_cents, total_cents: order.total_cents, application_fee_cents: applicationFeeAmount, application_fee_percent: feePercentSnapshot });
    return Response.json({ url: session.url });
  } catch (err) {
    logError("checkout.payment.failed", err, { request_id: requestId, store_id: store.id, order_id: order.id });
    const releaseClient = await db.connect();
    try {
      await releaseClient.query("BEGIN");
      await releaseInventory(releaseClient, store.id, lineItems);
      await releaseDiscountReservation(releaseClient, order.id);
      await releaseClient.query("update orders set inventory_reserved = false where id = $1", [order.id]);
      await releaseClient.query("COMMIT");
      logInfo("inventory.released", { request_id: requestId, store_id: store.id, order_id: order.id, reason: "checkout_session_failed" });
    } catch (releaseError) {
      await releaseClient.query("ROLLBACK");
      logError("inventory.release_failed", releaseError, { request_id: requestId, store_id: store.id, order_id: order.id });
    } finally { releaseClient.release(); }
    return Response.json({ error: "Payment setup failed, please try again" }, { status: 500 });
  }
}
