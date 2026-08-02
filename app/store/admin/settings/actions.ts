"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";

export async function updateStoreName(formData: FormData) {
  const store = await getCurrentStore();
  if (!store) throw new Error("No store context");

  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name is required");

  await db.query("update stores set name = $1 where id = $2", [name, store.id]);

  revalidatePath("/admin/settings");
}
