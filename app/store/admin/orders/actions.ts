"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";

export async function markFulfilled(formData: FormData) {
  const store = await getCurrentStore();
  if (!store) throw new Error("No store context");

  const orderId = String(formData.get("orderId"));

  // Only a 'paid' order can become 'fulfilled' — this also means the action
  // is a no-op (not an error) if clicked twice, or on an order that's still
  // pending.
  await db.query(
    "update orders set status = 'fulfilled' where id = $1 and store_id = $2 and status = 'paid'",
    [orderId, store.id]
  );

  revalidatePath("/admin/orders");
}
