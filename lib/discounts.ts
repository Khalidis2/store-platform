import type { PoolClient } from "pg";
import { db } from "./db";
import type { LineItem } from "./inventory";

export type DiscountType = "percent" | "fixed";

export type DiscountSnapshot = {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  discountCents: number;
};

export class DiscountUnavailableError extends Error {}

export function normalizeDiscountCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9_-]{3,32}$/.test(code) ? code : null;
}

export function calculateDiscountCents(subtotalCents: number, type: DiscountType, value: number) {
  if (subtotalCents <= 0) return 0;
  if (type === "percent") return Math.min(subtotalCents, Math.round(subtotalCents * (value / 100)));
  return Math.min(subtotalCents, value);
}

export async function findDiscountForCheckout(storeId: string, codeInput: unknown, subtotalCents: number): Promise<DiscountSnapshot | null> {
  const code = normalizeDiscountCode(codeInput);
  if (!code) return null;

  const { rows } = await db.query<{
    id: string;
    code: string;
    discount_type: DiscountType;
    discount_value: number;
  }>(
    `select d.id, d.code, d.discount_type, d.discount_value
       from discounts d
      where d.store_id = $1
        and d.code = $2
        and d.is_active = true
        and (d.starts_at is null or d.starts_at <= now())
        and (d.ends_at is null or d.ends_at > now())
        and (
          d.max_redemptions is null
          or (select count(*) from discount_redemptions r where r.discount_id = d.id and r.status in ('reserved','redeemed')) < d.max_redemptions
        )
      limit 1`,
    [storeId, code]
  );

  const discount = rows[0];
  if (!discount) return null;
  return {
    id: discount.id,
    code: discount.code,
    discountType: discount.discount_type,
    discountValue: discount.discount_value,
    discountCents: calculateDiscountCents(subtotalCents, discount.discount_type, discount.discount_value),
  };
}

export async function reserveDiscount(client: PoolClient, orderId: string, storeId: string, discountId: string) {
  const { rows } = await client.query<{
    id: string;
    is_active: boolean;
    starts_at: Date | null;
    ends_at: Date | null;
    max_redemptions: number | null;
  }>("select id, is_active, starts_at, ends_at, max_redemptions from discounts where id = $1 and store_id = $2 for update", [discountId, storeId]);

  const discount = rows[0];
  const now = Date.now();
  if (!discount || !discount.is_active || (discount.starts_at && discount.starts_at.getTime() > now) || (discount.ends_at && discount.ends_at.getTime() <= now)) {
    throw new DiscountUnavailableError("Discount code is no longer available");
  }

  const existing = await client.query<{ status: string }>("select status from discount_redemptions where order_id = $1 for update", [orderId]);
  if (existing.rows[0]?.status === "reserved" || existing.rows[0]?.status === "redeemed") return;

  if (discount.max_redemptions !== null) {
    const { rows: countRows } = await client.query<{ count: string }>(
      "select count(*)::text as count from discount_redemptions where discount_id = $1 and status in ('reserved','redeemed')",
      [discountId]
    );
    if (Number(countRows[0]?.count ?? 0) >= discount.max_redemptions) {
      throw new DiscountUnavailableError("Discount code has reached its usage limit");
    }
  }

  await client.query(
    `insert into discount_redemptions (discount_id, store_id, order_id, status)
     values ($1, $2, $3, 'reserved')
     on conflict (order_id) do update set discount_id = excluded.discount_id, store_id = excluded.store_id, status = 'reserved', redeemed_at = null`,
    [discountId, storeId, orderId]
  );
}

export async function redeemDiscount(orderId: string) {
  await db.query("update discount_redemptions set status = 'redeemed', redeemed_at = coalesce(redeemed_at, now()) where order_id = $1 and status = 'reserved'", [orderId]);
}

export async function releaseDiscountReservation(client: PoolClient, orderId: string) {
  await client.query("update discount_redemptions set status = 'released' where order_id = $1 and status = 'reserved'", [orderId]);
}

export function buildDiscountedStripeLines(items: LineItem[], discountCents: number) {
  let remaining = Math.max(0, discountCents);
  return items.map((item) => {
    const original = item.priceCents * item.quantity;
    const reduction = Math.min(original, remaining);
    remaining -= reduction;
    return {
      name: item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name,
      amountCents: original - reduction,
    };
  });
}
