"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getPlatformAdminUser } from "@/lib/platform-admin";

export async function updateStoreFee(formData: FormData) {
  // Re-checked here rather than trusting the layout guard alone — this
  // action changes another business's fee rate, worth the extra query.
  const admin = await getPlatformAdminUser();
  if (!admin) throw new Error("Not authorized");

  const storeId = String(formData.get("storeId"));
  const raw = String(formData.get("feePercent") || "").trim();

  if (raw === "") {
    // Blank means "clear the override, fall back to the platform default".
    await db.query("update stores set platform_fee_percent = null where id = $1", [storeId]);
    revalidatePath("/platform-admin");
    return;
  }

  const feePercent = Number(raw);
  if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) {
    throw new Error("Fee percent must be a number between 0 and 100");
  }

  await db.query("update stores set platform_fee_percent = $1 where id = $2", [feePercent, storeId]);

  revalidatePath("/platform-admin");
}
