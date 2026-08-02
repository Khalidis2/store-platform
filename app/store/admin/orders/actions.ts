"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";
import { stripe } from "@/lib/stripe";
import { applyRefund, markOrderDelivered } from "@/lib/orders";
import { createAftershipTracking, type SupportedCarrier } from "@/lib/aftership";

export async function markShipped(formData: FormData) {
  const store = await getCurrentStore();
  if (!store) throw new Error("No store context");

  const orderId = String(formData.get("orderId"));
  const trackingNumber = String(formData.get("trackingNumber") || "").trim() || null;
  const carrier = String(formData.get("carrier") || "").trim() || null;

  await db.query(
    "update orders set status = 'shipped', tracking_number = $1, carrier = $2, has_shipped = true where id = $3 and store_id = $4 and status = 'paid'",
    [trackingNumber, carrier, orderId, store.id]
  );

  // Only register with AfterShip for carriers we actually support automated
  // tracking for — "other" (or a blank carrier) just stores the tracking
  // number as before, no automated delivery detection.
  if (trackingNumber && (carrier === "aramex" || carrier === "emirates_post")) {
    await createAftershipTracking({
      trackingNumber,
      carrier: carrier as SupportedCarrier,
      orderId,
    });
  }

  revalidatePath("/admin/orders");
}

export async function markDelivered(formData: FormData) {
  const store = await getCurrentStore();
  if (!store) throw new Error("No store context");

  const orderId = String(formData.get("orderId"));
  await markOrderDelivered(orderId, store.id);

  revalidatePath("/admin/orders");
}

export async function refundOrder(formData: FormData) {
  const store = await getCurrentStore();
  if (!store) throw new Error("No store context");

  const orderId = String(formData.get("orderId"));
  const amountInput = String(formData.get("amount") || "").trim();

  const { rows } = await db.query(
    "select status, stripe_payment_intent_id, total_cents, refunded_amount_cents from orders where id = $1 and store_id = $2",
    [orderId, store.id]
  );
  const order = rows[0];

  if (!order) throw new Error("Order not found");
  if (!["paid", "shipped", "partially_refunded"].includes(order.status)) {
    throw new Error("This order can't be refunded further");
  }
  if (!order.stripe_payment_intent_id) {
    throw new Error("No payment record found for this order");
  }

  const remainingCents = order.total_cents - order.refunded_amount_cents;
  if (remainingCents <= 0) {
    throw new Error("This order has already been fully refunded");
  }

  let thisRefundCents = remainingCents;
  if (amountInput) {
    const parsed = Math.round(parseFloat(amountInput) * 100);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("Enter a valid refund amount");
    }
    if (parsed > remainingCents) {
      throw new Error(
        `Refund amount can't exceed the remaining balance of AED ${(remainingCents / 100).toFixed(2)}`
      );
    }
    thisRefundCents = parsed;
  }

  await stripe.refunds.create({
    payment_intent: order.stripe_payment_intent_id,
    amount: thisRefundCents,
    reverse_transfer: true,
    refund_application_fee: true,
  });

  const newCumulativeRefunded = order.refunded_amount_cents + thisRefundCents;
  await applyRefund(orderId, store.id, newCumulativeRefunded);

  revalidatePath("/admin/orders");
}
