import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { releaseInventory, type LineItem } from "@/lib/inventory";
import { applyRefund } from "@/lib/orders";
import { sendOrderPaidEmails } from "@/lib/email";
import { claimLowStockAlerts } from "@/lib/low-stock";
import { sendLowStockAlertEmail } from "@/lib/low-stock-email";
import { redeemDiscount, releaseDiscountReservation } from "@/lib/discounts";
import { claimWebhookEvent, markWebhookFailed, markWebhookProcessed } from "@/lib/webhook-events";
import { requireWebhookSecret } from "@/lib/webhook-runtime";
import { getRequestId, logError, logInfo, logWarn } from "@/lib/logger";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  const secret = requireWebhookSecret("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("Stripe webhook secret is not configured", { status: 503 });

  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(rawBody, signature!, secret); }
  catch { logWarn("webhook.stripe.signature_rejected", { request_id: requestId }); return new Response("Webhook signature verification failed", { status: 400 }); }

  const shouldProcess = await claimWebhookEvent("stripe", event.id, event.type, event);
  if (!shouldProcess) { logInfo("webhook.stripe.duplicate", { request_id: requestId, stripe_event_id: event.id, event_type: event.type }); return Response.json({ received: true, duplicate: true }); }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId;
        if (orderId) {
          const { rows } = await db.query<{ store_id: string; line_items: LineItem[] }>(
            `update orders set status = 'paid', stripe_payment_intent_id = $1, paid_at = coalesce(paid_at, now()) where id = $2 and status = 'pending' returning store_id, line_items`,
            [session.payment_intent, orderId]
          );
          await redeemDiscount(orderId);
          if (rows[0]) {
            logInfo("order.payment.completed", { request_id: requestId, store_id: rows[0].store_id, order_id: orderId, stripe_event_id: event.id });
            const lowStockAlerts = await claimLowStockAlerts(rows[0].store_id, rows[0].line_items);
            await sendOrderPaidEmails(orderId, rows[0].store_id);
            await sendLowStockAlertEmail(rows[0].store_id, lowStockAlerts);
          }
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId;
        if (orderId) await releaseExpiredReservation(orderId);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (paymentIntentId) {
          const { rows } = await db.query("select id, store_id from orders where stripe_payment_intent_id = $1", [paymentIntentId]);
          if (rows[0]) await applyRefund(rows[0].id, rows[0].store_id, charge.amount_refunded);
        }
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        if (account.charges_enabled && account.details_submitted) await db.query("update stores set is_live = true where stripe_account_id = $1", [account.id]);
        break;
      }
      default: break;
    }
    await markWebhookProcessed("stripe", event.id);
    logInfo("webhook.stripe.processed", { request_id: requestId, stripe_event_id: event.id, event_type: event.type });
    return Response.json({ received: true });
  } catch (err) {
    try { await markWebhookFailed("stripe", event.id, err); }
    catch (ledgerError) { logError("webhook.stripe.ledger_failed", ledgerError, { request_id: requestId, stripe_event_id: event.id }); }
    logError("webhook.stripe.failed", err, { request_id: requestId, stripe_event_id: event.id, event_type: event.type });
    return new Response("Webhook processing failed", { status: 500 });
  }
}

async function releaseExpiredReservation(orderId: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`update orders set status = 'expired' where id = $1 and status = 'pending' and inventory_reserved = true returning store_id, line_items`, [orderId]);
    if (rows.length > 0) {
      const { store_id, line_items } = rows[0] as { store_id: string; line_items: LineItem[] };
      await releaseInventory(client, store_id, line_items);
      await releaseDiscountReservation(client, orderId);
      await client.query("update orders set inventory_reserved = false where id = $1", [orderId]);
    }
    await client.query("COMMIT");
  } catch (err) { await client.query("ROLLBACK"); throw err; }
  finally { client.release(); }
}
