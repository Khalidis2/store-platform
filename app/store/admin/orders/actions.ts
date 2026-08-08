"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOwnedStore } from "@/lib/get-store";
import { stripe } from "@/lib/stripe";
import { applyRefund, markOrderDelivered } from "@/lib/orders";
import { logAction } from "@/lib/audit";
import { sendOrderShippedEmail } from "@/lib/email";
import { processTrackingRegistrations } from "@/lib/tracking-registration";

const AUTOMATED_CARRIERS = new Set(["aramex", "emirates_post"]);

export async function markShipped(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const orderId = String(formData.get("orderId"));
  const trackingNumber = String(formData.get("trackingNumber") || "").trim() || null;
  const carrier = String(formData.get("carrier") || "").trim() || null;
  const requiresRegistration = Boolean(trackingNumber && carrier && AUTOMATED_CARRIERS.has(carrier));

  const { rows } = await db.query(
    `update orders
        set status = 'shipped',
            tracking_number = $1,
            carrier = $2,
            has_shipped = true,
            tracking_registration_status = $5,
            tracking_registration_attempt_count = 0,
            tracking_registration_next_attempt_at = now(),
            tracking_registration_processing_started_at = null,
            tracking_registered_at = null,
            tracking_registration_error = null
      where id = $3 and store_id = $4 and status = 'paid'
      returning id`,
    [trackingNumber, carrier, orderId, store.id, requiresRegistration ? "pending" : "not_required"]
  );

  if (rows.length > 0) {
    await sendOrderShippedEmail(orderId, store.id);
    if (requiresRegistration) await processTrackingRegistrations(1, orderId, store.id);
  }

  revalidatePath("/admin/orders");
}

export async function retryTrackingRegistration(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");
  const orderId = String(formData.get("orderId") || "");
  if (!orderId) throw new Error("Order is required");

  await db.query(
    `update orders
        set tracking_registration_status = 'pending',
            tracking_registration_next_attempt_at = now(),
            tracking_registration_processing_started_at = null,
            tracking_registration_error = null,
            tracking_registered_at = null
      where id = $1
        and store_id = $2
        and tracking_number is not null
        and carrier in ('aramex','emirates_post')
        and tracking_registration_status = 'failed'`,
    [orderId, store.id]
  );

  await processTrackingRegistrations(1, orderId, store.id);
  revalidatePath("/admin/orders");
}

export async function markDelivered(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");
  const orderId = String(formData.get("orderId"));
  await markOrderDelivered(orderId, store.id);
  revalidatePath("/admin/orders");
}

export async function refundOrder(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const orderId = String(formData.get("orderId"));
  const amountInput = String(formData.get("amount") || "").trim();
  const { rows } = await db.query(
    "select status, stripe_payment_intent_id, total_cents, refunded_amount_cents from orders where id = $1 and store_id = $2",
    [orderId, store.id]
  );
  const order = rows[0];
  if (!order) throw new Error("Order not found");
  if (!["paid", "shipped", "partially_refunded"].includes(order.status)) throw new Error("This order can't be refunded further");
  if (!order.stripe_payment_intent_id) throw new Error("No payment record found for this order");

  const remainingCents = order.total_cents - order.refunded_amount_cents;
  if (remainingCents <= 0) throw new Error("This order has already been fully refunded");
  let thisRefundCents = remainingCents;
  if (amountInput) {
    const parsed = Math.round(parseFloat(amountInput) * 100);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Enter a valid refund amount");
    if (parsed > remainingCents) throw new Error(`Refund amount can't exceed the remaining balance of AED ${(remainingCents / 100).toFixed(2)}`);
    thisRefundCents = parsed;
  }

  await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id, amount: thisRefundCents, reverse_transfer: true, refund_application_fee: true });
  const newCumulativeRefunded = order.refunded_amount_cents + thisRefundCents;
  await applyRefund(orderId, store.id, newCumulativeRefunded);
  await logAction({ storeId: store.id, actorUserId: store.owner_user_id, actorRole: "merchant", action: "refund", targetType: "order", targetId: orderId, metadata: { amountCents: thisRefundCents, cumulativeRefundedCents: newCumulativeRefunded } });
  revalidatePath("/admin/orders");
}
