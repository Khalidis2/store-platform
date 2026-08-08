"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getPlatformAdminUser } from "@/lib/platform-admin";
import { logAction } from "@/lib/audit";

export async function updateStoreFee(formData: FormData) {
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

export async function setPlatformStoreStatus(formData: FormData) {
  const admin = await getPlatformAdminUser();
  if (!admin) throw new Error("Not authorized");

  const storeId = String(formData.get("storeId") || "");
  const requested = String(formData.get("status") || "");
  if (!storeId || !["suspended", "closed", "draft"].includes(requested)) {
    throw new Error("Invalid store status update");
  }

  const { rows } = await db.query<{ status: string }>(
    "select status from stores where id = $1",
    [storeId]
  );
  const currentStatus = rows[0]?.status;
  if (!currentStatus) throw new Error("Store not found");

  if (requested === "draft" && currentStatus !== "suspended" && currentStatus !== "closed") {
    throw new Error("Only suspended or closed stores can be reopened");
  }
  if (requested === currentStatus) return;

  await db.query("update stores set status = $1 where id = $2", [requested, storeId]);

  await logAction({
    storeId,
    actorUserId: admin.id,
    actorRole: "platform_admin",
    action: requested === "suspended" ? "suspend_store" : requested === "closed" ? "close_store" : "reopen_store",
    targetType: "store",
    targetId: storeId,
    metadata: { oldStatus: currentStatus, newStatus: requested },
  });

  revalidatePath("/platform-admin");
  revalidatePath("/");
}
