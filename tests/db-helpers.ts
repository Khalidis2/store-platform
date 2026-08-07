import { randomUUID } from "crypto";
import { db } from "@/lib/db";

export async function createTestStore(overrides: Partial<{ isLive: boolean; hasStripeAccount: boolean }> = {}) {
  const subdomain = `vitest-${randomUUID().slice(0, 8)}`;
  const { rows } = await db.query<{ id: string }>(
    `insert into stores (subdomain, name, owner_user_id, is_live, stripe_account_id)
     values ($1, $2, $3, $4, $5) returning id`,
    [
      subdomain,
      `Vitest Store ${subdomain}`,
      randomUUID(),
      overrides.isLive ?? true,
      overrides.hasStripeAccount === false ? null : "acct_vitest_fake",
    ]
  );
  return rows[0].id;
}

export async function createTestProduct(storeId: string, inventory: number, priceCents = 1000) {
  const { rows } = await db.query<{ id: string }>(
    `insert into products (store_id, name, price_cents, inventory)
     values ($1, $2, $3, $4) returning id`,
    [storeId, `Vitest Product`, priceCents, inventory]
  );
  return rows[0].id;
}

export async function createTestOrder(
  storeId: string,
  lineItems: { productId: string; name: string; priceCents: number; quantity: number }[],
  overrides: Partial<{
    status: string;
    totalCents: number;
    hasShipped: boolean;
    refundedAmountCents: number;
    createdAt: Date;
  }> = {}
) {
  const totalCents =
    overrides.totalCents ?? lineItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  const { rows } = await db.query<{ id: string }>(
    `insert into orders
       (store_id, customer_email, total_cents, status, line_items, has_shipped,
        refunded_amount_cents, inventory_reserved, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, true, $8)
     returning id`,
    [
      storeId,
      "vitest@example.test",
      totalCents,
      overrides.status ?? "paid",
      JSON.stringify(lineItems),
      overrides.hasShipped ?? false,
      overrides.refundedAmountCents ?? 0,
      overrides.createdAt ?? new Date(),
    ]
  );
  return rows[0].id;
}

export async function getProductInventory(productId: string) {
  const { rows } = await db.query<{ inventory: number }>(
    `select inventory from products where id = $1`,
    [productId]
  );
  return rows[0].inventory;
}

export async function getOrder(orderId: string) {
  const { rows } = await db.query(
    `select status, refunded_amount_cents, inventory_reserved from orders where id = $1`,
    [orderId]
  );
  return rows[0];
}

export async function cleanupStore(storeId: string) {
  await db.query(`delete from stores where id = $1`, [storeId]);
}
