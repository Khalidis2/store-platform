"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOwnedStore } from "@/lib/get-store";
import { uploadImage } from "@/lib/upload-image";
import { logAction } from "@/lib/audit";

export async function createProduct(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const name = String(formData.get("name") || "").trim();
  const priceCents = Math.round(Number(formData.get("price")) * 100);
  const inventory = Number(formData.get("inventory") || 0);
  const description = String(formData.get("description") || "").trim() || null;
  const category = String(formData.get("category") || "").trim() || null;

  if (!name || !priceCents || priceCents <= 0) {
    throw new Error("Name and a valid price are required");
  }

  const imageFile = formData.get("image");
  const imageUrl =
    imageFile instanceof File && imageFile.size > 0
      ? await uploadImage(imageFile, `${store.id}/products`)
      : null;

  await db.query(
    `insert into products (store_id, name, price_cents, image_url, inventory, description, category)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [store.id, name, priceCents, imageUrl, inventory, description, category]
  );

  revalidatePath("/admin/products");
}

export async function updateInventory(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const productId = String(formData.get("productId"));
  const inventory = Number(formData.get("inventory"));

  // store_id in the WHERE clause is what stops a merchant from editing
  // another store's product even if they somehow guess its id.
  await db.query(`update products set inventory = $1 where id = $2 and store_id = $3`, [
    inventory,
    productId,
    store.id,
  ]);

  revalidatePath("/admin/products");
}

/**
 * Full product edit (name, price, description, inventory, and optionally a
 * new image) — updateInventory above only ever handled the one field, there
 * was previously no way to fix a typo in a product's name or price after
 * creating it.
 */
export async function updateProduct(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const productId = String(formData.get("productId"));
  const name = String(formData.get("name") || "").trim();
  const priceCents = Math.round(Number(formData.get("price")) * 100);
  const inventory = Number(formData.get("inventory") || 0);
  const description = String(formData.get("description") || "").trim() || null;
  const category = String(formData.get("category") || "").trim() || null;

  if (!name || !priceCents || priceCents <= 0) {
    throw new Error("Name and a valid price are required");
  }

  const { rows } = await db.query(
    `select image_url from products where id = $1 and store_id = $2`,
    [productId, store.id]
  );
  if (!rows[0]) throw new Error("Product not found");

  const imageFile = formData.get("image");
  const imageUrl =
    imageFile instanceof File && imageFile.size > 0
      ? await uploadImage(imageFile, `${store.id}/products`)
      : rows[0].image_url;

  await db.query(
    `update products set name = $1, price_cents = $2, inventory = $3, description = $4, image_url = $5, category = $6
     where id = $7 and store_id = $8`,
    [name, priceCents, inventory, description, imageUrl, category, productId, store.id]
  );

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}/edit`);
}

export async function deleteProduct(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const productId = String(formData.get("productId"));

  const { rows } = await db.query(
    `delete from products where id = $1 and store_id = $2 returning name`,
    [productId, store.id]
  );

  if (rows[0]) {
    await logAction({
      storeId: store.id,
      actorUserId: store.owner_user_id,
      actorRole: "merchant",
      action: "delete_product",
      targetType: "product",
      targetId: productId,
      metadata: { name: rows[0].name },
    });
  }

  revalidatePath("/admin/products");
}
