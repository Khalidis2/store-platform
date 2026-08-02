"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";

export async function markShipped(formData: FormData) {
  const store = await getCurrentStore();
  if (!store) throw new Error("No store context");

  const orderId = String(formData.get("orderId"));
  const trackingNumber = String(formData.get("trackingNumber") || "").trim() || null;

  // Only a 'paid' order can move to 'shipped' — this also means the action
  // is a safe no-op if the button is clicked twice.
  await db.query(
    "update orders set status = 'shipped', tracking_number = $1 where id = $2 and store_id = $3 and status = 'paid'",
    [trackingNumber, orderId, store.id]
  );

  revalidatePath("/admin/orders");
}
