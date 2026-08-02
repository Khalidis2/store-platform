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
    "update orders set status = 'shipped', tracking_number = $1 where id = $2 and store_id = $3 and status = 'paid'",
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
    "select status, stripe_payment_intent_id, total_cents from orders where id = $1 and store_id = $2",
    [orderId, store.id]
  );
  const order = rows[0];

  if (!order) throw new Error("Order not found");
  if (!["paid", "shipped"].includes(order.status)) {
    throw new Error("Only paid or shipped orders can be refunded");
  }
  if (!order.stripe_payment_intent_id) {
    throw new Error("No payment record found for this order");
  }

  let amountCents = order.total_cents;
  if (amountInput) {
    const parsed = Math.round(parseFloat(amountInput) * 100);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("Enter a valid refund amount");
    }
    if (parsed > order.total_cents) {
      throw new Error("Refund amount can't exceed the order total");
    }
    amountCents = parsed;
  }

  const isFullRefund = amountCents >= order.total_cents;

  // Full refund: omit `amount` entirely so Stripe refunds the whole charge.
  // Partial: pass the amount — Stripe automatically prorates the
  // application fee refund to match, when refund_application_fee is true.
  await stripe.refunds.create({
    payment_intent: order.stripe_payment_intent_id,
    ...(isFullRefund ? {} : { amount: amountCents }),
    reverse_transfer: true,
    refund_application_fee: true,
  });

  await applyRefund(orderId, store.id, amountCents);

  revalidatePath("/admin/orders");
}
