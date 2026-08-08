"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOwnedStore } from "@/lib/get-store";
import { logAction } from "@/lib/audit";

export async function setProductStatus(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const productId = String(formData.get("productId") || "");
  const status = String(formData.get("status") || "");
  if (!productId || !['draft', 'active', 'archived'].includes(status)) {
    throw new Error("Invalid product lifecycle update");
  }

  const { rows } = await db.query(
    "update products set status = $1 where id = $2 and store_id = $3 returning name",
    [status, productId, store.id]
  );
  if (!rows[0]) throw new Error("Product not found");

  await logAction({
    storeId: store.id,
    actorUserId: store.owner_user_id,
    actorRole: "merchant",
    action: `set_product_${status}`,
    targetType: "product",
    targetId: productId,
    metadata: { name: rows[0].name, status },
  });

  revalidatePath("/admin/products");
  revalidatePath("/");
}
