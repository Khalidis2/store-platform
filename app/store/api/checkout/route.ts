import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getRequestId, logInfo, logWarn } from "@/lib/logger";
import { calculateShippingCents } from "@/lib/shipping";
import { findDiscountForCheckout, normalizeDiscountCode } from "@/lib/discounts";

type CartLine = { productId: string; quantity: number };
type ShippingAddress = {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
};

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const store = await getCurrentStore();
  if (!store) return Response.json({ error: "Store not found" }, { status: 404 });
  if (store.status !== "active") return Response.json({ error: "This store is not accepting orders" }, { status: 403 });

  const ip = getClientIp(req);
  const checkoutLimit = await rateLimit({ scope: "checkout:create", subject: `${store.id}:${ip}`, limit: 20, windowSeconds: 600 });
  if (!checkoutLimit.allowed) {
    logWarn("checkout.rate_limited", { request_id: requestId, store_id: store.id });
    return rateLimitResponse(checkoutLimit);
  }

  const { email, items, shipping, discountCode } = (await req.json()) as {
    email?: string;
    items?: CartLine[];
    shipping?: ShippingAddress;
    discountCode?: string;
  };

  if (!email || !Array.isArray(items) || items.length === 0) return Response.json({ error: "Email and at least one item are required" }, { status: 400 });
  if (!shipping?.fullName || !shipping?.phone || !shipping?.addressLine1 || !shipping?.city || !shipping?.country) return Response.json({ error: "Shipping address is incomplete" }, { status: 400 });

  const productIds = items.map((i) => i.productId);
  const { rows: products } = await db.query(
    "select id, name, price_cents, inventory from products where store_id = $1 and status = 'active' and id = any($2)",
    [store.id, productIds]
  );

  const productMap = new Map(products.map((p: any) => [p.id, p]));
  let subtotalCents = 0;
  const lineItems: { productId: string; name: string; priceCents: number; quantity: number }[] = [];

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) continue;
    const quantity = Math.max(1, Number(item.quantity) || 1);
    if (quantity > product.inventory) return Response.json({ error: `Only ${product.inventory} of "${product.name}" left in stock` }, { status: 409 });
    subtotalCents += product.price_cents * quantity;
    lineItems.push({ productId: product.id, name: product.name, priceCents: product.price_cents, quantity });
  }

  if (lineItems.length === 0) return Response.json({ error: "No active items in cart" }, { status: 400 });

  let discount = null;
  if (String(discountCode ?? "").trim()) {
    if (!normalizeDiscountCode(discountCode)) return Response.json({ error: "Invalid discount code format" }, { status: 400 });
    discount = await findDiscountForCheckout(store.id, discountCode, subtotalCents);
    if (!discount) return Response.json({ error: "Discount code is invalid, expired, or unavailable" }, { status: 409 });
  }

  const discountCents = discount?.discountCents ?? 0;
  const shippingCents = calculateShippingCents(subtotalCents, store.shipping_flat_cents, store.free_shipping_threshold_cents);
  const totalCents = subtotalCents - discountCents + shippingCents;

  const result = await db.query(
    `insert into orders (
       store_id, customer_email, subtotal_cents, discount_id, discount_code, discount_type, discount_value,
       discount_cents, shipping_cents, total_cents, status, line_items, shipping_address
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12) returning id`,
    [store.id, email, subtotalCents, discount?.id ?? null, discount?.code ?? null, discount?.discountType ?? null, discount?.discountValue ?? null, discountCents, shippingCents, totalCents, JSON.stringify(lineItems), JSON.stringify(shipping)]
  );

  const orderId = result.rows[0].id;
  logInfo("checkout.order.created", { request_id: requestId, store_id: store.id, order_id: orderId, item_count: lineItems.length, subtotal_cents: subtotalCents, discount_cents: discountCents, shipping_cents: shippingCents, total_cents: totalCents });
  return Response.json({ orderId, subtotalCents, discountCents, shippingCents, totalCents, discountCode: discount?.code ?? null });
}
