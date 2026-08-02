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

export async function refundOrder(formData: FormData) {
  const store = await getCurrentStore();
  if (!store) throw new Error("No store context");

  const orderId = String(formData.get("orderId"));

  const { rows } = await db.query(
    "select status, stripe_payment_intent_id from orders where id = $1 and store_id = $2",
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

  // Full refund: reverse the transfer to the merchant's connected account
  // AND refund the platform's own application fee — otherwise the platform
  // would keep a fee on an order that got cancelled.
  await stripe.refunds.create({
    payment_intent: order.stripe_payment_intent_id,
    reverse_transfer: true,
    refund_application_fee: true,
  });

  await applyRefund(orderId, store.id);

  revalidatePath("/admin/orders");
}
