"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOwnedStore } from "@/lib/get-store";

export async function createProduct(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const name = String(formData.get("name") || "").trim();
  const priceCents = Math.round(Number(formData.get("price")) * 100);
  const inventory = Number(formData.get("inventory") || 0);
  const imageUrl = String(formData.get("imageUrl") || "") || null;

  if (!name || !priceCents || priceCents <= 0) {
    throw new Error("Name and a valid price are required");
  }

  await db.query(
    `insert into products (store_id, name, price_cents, image_url, inventory)
     values ($1, $2, $3, $4, $5)`,
    [store.id, name, priceCents, imageUrl, inventory]
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

export async function deleteProduct(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const productId = String(formData.get("productId"));

  await db.query(`delete from products where id = $1 and store_id = $2`, [productId, store.id]);

  revalidatePath("/admin/products");
}
