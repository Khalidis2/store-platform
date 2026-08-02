import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";

type CartLine = { productId: string; quantity: number };

export async function POST(req: Request) {
  const store = await getCurrentStore();
  if (!store) {
    return Response.json({ error: "Store not found" }, { status: 404 });
  }

  const { email, items } = (await req.json()) as { email?: string; items?: CartLine[] };

  if (!email || !Array.isArray(items) || items.length === 0) {
    return Response.json({ error: "Email and at least one item are required" }, { status: 400 });
  }

  // Re-fetch authoritative prices from the DB rather than trusting whatever
  // the client sent — a tampered request could otherwise set its own prices.
  const productIds = items.map((i) => i.productId);
  const { rows: products } = await db.query(
    "select id, name, price_cents from products where store_id = $1 and id = any($2)",
    [store.id, productIds]
  );

  const priceMap = new Map(products.map((p: any) => [p.id, p]));
  let totalCents = 0;
  const lineItems: { productId: string; name: string; priceCents: number; quantity: number }[] = [];

  for (const item of items) {
    const product = priceMap.get(item.productId);
    if (!product) continue; // product no longer exists — skip rather than fail the whole order
    const quantity = Math.max(1, Number(item.quantity) || 1);
    totalCents += product.price_cents * quantity;
    lineItems.push({
      productId: product.id,
      name: product.name,
      priceCents: product.price_cents,
      quantity,
    });
  }

  if (lineItems.length === 0) {
    return Response.json({ error: "No valid items in cart" }, { status: 400 });
  }

  const result = await db.query(
    `insert into orders (store_id, customer_email, total_cents, status, line_items)
     values ($1, $2, $3, 'pending', $4) returning id`,
    [store.id, email, totalCents, JSON.stringify(lineItems)]
  );

  return Response.json({ orderId: result.rows[0].id });
}
