"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";
import { stripe } from "@/lib/stripe";
import { applyRefund } from "@/lib/orders";

export async function markShipped(formData: FormData) {
  const store = await getCurrentStore();
  if (!store) throw new Error("No store context");

  const orderId = String(formData.get("orderId"));
  const trackingNumber = String(formData.get("trackingNumber") || "").trim() || null;

  await db.query(
    "update orders set status = 'shipped', tracking_number = $1, has_shipped = true where id = $2 and store_id = $3 and status = 'paid'",
    [trackingNumber, orderId, store.id]
  );

  revalidatePath("/admin/orders");
}

export async function markDelivered(formData: FormData) {
  const store = await getCurrentStore();
  if (!store) throw new Error("No store context");

  const orderId = String(formData.get("orderId"));

  await db.query(
    "update orders set status = 'delivered' where id = $1 and store_id = $2 and status = 'shipped'",
    [orderId, store.id]
  );

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

  // Remaining balance, not the original total — this order may already
  // have one or more prior partial refunds against it.
  const remainingCents = order.total_cents - order.refunded_amount_cents;
  if (remainingCents <= 0) {
    throw new Error("This order has already been fully refunded");
  }

  let thisRefundCents = remainingCents; // default: refund whatever's left
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

  // Always pass an explicit amount for THIS refund — never omit it to mean
  // "refund everything," since on a second-or-later refund that would be
  // ambiguous to reason about. Stripe prorates the application fee refund
  // to match whatever amount is passed here.
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
