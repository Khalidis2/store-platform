"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOwnedStore } from "@/lib/get-store";
import { logAction } from "@/lib/audit";

export async function setStoreStatus(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const status = String(formData.get("status") || "");
  if (!['draft', 'active'].includes(status)) throw new Error("Invalid store status");
  if (status === 'active' && !store.is_live) {
    throw new Error("Complete Stripe onboarding before publishing your store");
  }
  if (store.status === 'suspended' || store.status === 'closed') {
    throw new Error("This store status can only be changed by the platform owner");
  }

  const { rows } = await db.query(
    "update stores set status = $1 where id = $2 and status in ('draft','active') returning status",
    [status, store.id]
  );
  if (!rows[0]) return;

  await logAction({
    storeId: store.id,
    actorUserId: store.owner_user_id,
    actorRole: "merchant",
    action: status === 'active' ? 'publish_store' : 'unpublish_store',
    targetType: "store",
    targetId: store.id,
    metadata: { status },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/");
}
