"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getPlatformAdminUser } from "@/lib/platform-admin";
import { logAction } from "@/lib/audit";

export async function updateStoreFee(formData: FormData) {
  // Re-checked here rather than trusting the layout guard alone — this
  // action changes another business's fee rate, worth the extra query.
  const admin = await getPlatformAdminUser();
  if (!admin) throw new Error("Not authorized");

  const storeId = String(formData.get("storeId"));
  const raw = String(formData.get("feePercent") || "").trim();

  const { rows } = await db.query("select platform_fee_percent from stores where id = $1", [storeId]);
  const oldFeePercent = rows[0]?.platform_fee_percent ?? null;

  const newFeePercent = raw === "" ? null : Number(raw);
  if (raw !== "" && (!Number.isFinite(newFeePercent) || newFeePercent! < 0 || newFeePercent! > 100)) {
    throw new Error("Fee percent must be a number between 0 and 100");
  }

  // Blank means "clear the override, fall back to the platform default".
  await db.query("update stores set platform_fee_percent = $1 where id = $2", [newFeePercent, storeId]);

  await logAction({
    storeId,
    actorUserId: admin.id,
    actorRole: "platform_admin",
    action: "update_fee",
    targetType: "store",
    targetId: storeId,
    metadata: { oldFeePercent, newFeePercent },
  });

  revalidatePath("/platform-admin");
}
