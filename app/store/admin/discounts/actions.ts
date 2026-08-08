"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getOwnedStore } from "@/lib/get-store";
import { normalizeDiscountCode } from "@/lib/discounts";

function parseOptionalDubaiDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(`${raw}:00+04:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid UAE date and time");
  return date;
}

export async function createDiscount(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const code = normalizeDiscountCode(formData.get("code"));
  const discountType = String(formData.get("discountType") || "");
  const rawValue = Number(formData.get("value"));
  const startsAt = parseOptionalDubaiDate(formData.get("startsAt"));
  const endsAt = parseOptionalDubaiDate(formData.get("endsAt"));
  const maxRaw = String(formData.get("maxRedemptions") || "").trim();
  const maxRedemptions = maxRaw ? Number(maxRaw) : null;

  if (!code) throw new Error("Code must be 3–32 letters, numbers, hyphens, or underscores");
  if (!['percent', 'fixed'].includes(discountType)) throw new Error("Invalid discount type");
  if (!Number.isFinite(rawValue) || rawValue <= 0) throw new Error("Discount value must be greater than zero");
  if (discountType === "percent" && rawValue > 100) throw new Error("Percentage discount cannot exceed 100%");
  if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions <= 0)) throw new Error("Usage limit must be a positive whole number");
  if (startsAt && endsAt && startsAt >= endsAt) throw new Error("End time must be after start time");

  const discountValue = discountType === "fixed" ? Math.round(rawValue * 100) : Math.round(rawValue);

  await db.query(
    `insert into discounts (store_id, code, discount_type, discount_value, starts_at, ends_at, max_redemptions)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [store.id, code, discountType, discountValue, startsAt, endsAt, maxRedemptions]
  );
  revalidatePath("/admin/discounts");
}

export async function setDiscountActive(formData: FormData) {
  const store = await getOwnedStore();
  if (!store) throw new Error("Not authorized");

  const discountId = String(formData.get("discountId") || "");
  const isActive = String(formData.get("isActive") || "") === "true";
  if (!discountId) throw new Error("Discount is required");

  await db.query("update discounts set is_active = $1 where id = $2 and store_id = $3", [isActive, discountId, store.id]);
  revalidatePath("/admin/discounts");
}
