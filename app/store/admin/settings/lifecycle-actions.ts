"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOwnedStore } from "@/lib/get-store";
import { logAction } from "@/lib/audit";
import { isStoreReadyToPublish } from "@/lib/merchant-onboarding";

export async function setStoreStatus(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const status = String(formData.get("status") || "");
  if (!["draft", "active"].includes(status)) throw new Error("Invalid store status");
  if (store.status === "suspended" || store.status === "closed") throw new Error("This store status can only be changed by the platform owner");

  if (status === "active") {
    const { rows } = await db.query<{ count: string }>("select count(*)::text as count from products where store_id = $1 and status = 'active'", [store.id]);
    if (!isStoreReadyToPublish(store, Number(rows[0]?.count ?? 0))) {
      throw new Error("Complete every required Store setup step before publishing your store");
    }
  }

  const { rows } = await db.query("update stores set status = $1 where id = $2 and status in ('draft','active') returning status", [status, store.id]);
  if (!rows[0]) return;

  await logAction({ storeId: store.id, actorUserId: store.owner_user_id, actorRole: "merchant", action: status === "active" ? "publish_store" : "unpublish_store", targetType: "store", targetId: store.id, metadata: { status } });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/admin/onboarding");
  revalidatePath("/");
}
