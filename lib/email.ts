import { db } from "./db";
import { enqueueEmail } from "./email-outbox";
import type { LineItem } from "./inventory";
import { logWarn } from "./logger";

type OrderEmailContext = {
  id: string;
  customer_email: string;
  status: string;
  subtotal_cents: number;
  discount_code: string | null;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  refunded_amount_cents: number;
  line_items: LineItem[];
  public_token: string;
  tracking_number: string | null;
  carrier: string | null;
  store_name: string;
  subdomain: string;
  notification_email: string | null;
};

function money(cents: number) {
  return `AED ${(cents / 100).toFixed(2)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function orderUrl(order: OrderEmailContext) {
  const root = process.env.PLATFORM_ROOT_URL;
  if (!root) return null;
  try {
    const url = new URL(root);
    url.hostname = `${order.subdomain}.${url.hostname}`;
    url.pathname = `/order/${order.public_token}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    logWarn("email.order_link.invalid_root_url");
    return null;
  }
}

async function loadOrder(orderId: string, storeId: string): Promise<OrderEmailContext | null> {
  const { rows } = await db.query<OrderEmailContext>(
    `select o.id, o.customer_email, o.status, o.subtotal_cents, o.discount_code,
            o.discount_cents, o.shipping_cents, o.total_cents, o.refunded_amount_cents,
            o.line_items, o.public_token, o.tracking_number, o.carrier,
            s.name as store_name, s.subdomain, s.notification_email
       from orders o
       join stores s on s.id = o.store_id
      where o.id = $1 and o.store_id = $2`,
    [orderId, storeId]
  );
  return rows[0] ?? null;
}

function itemsHtml(items: LineItem[]) {
  return items
    .map((item) => `<li>${escapeHtml(item.name)} × ${item.quantity} — ${money(item.priceCents * item.quantity)}</li>`)
    .join("");
}

function totalsHtml(order: OrderEmailContext) {
  const shipping = order.shipping_cents === 0 ? "Free" : money(order.shipping_cents);
  const discount = order.discount_cents > 0
    ? `<br/>Discount${order.discount_code ? ` (${escapeHtml(order.discount_code)})` : ""}: −${money(order.discount_cents)}`
    : "";
  return `<p>Subtotal: ${money(order.subtotal_cents)}${discount}<br/>Delivery: ${shipping}<br/><strong>Total: ${money(order.total_cents)}</strong></p>`;
}

function trackingLinkHtml(order: OrderEmailContext) {
  const url = orderUrl(order);
  return url ? `<p><a href="${escapeHtml(url)}">View your order</a></p>` : "";
}

export async function sendOrderPaidEmails(orderId: string, storeId: string) {
  const order = await loadOrder(orderId, storeId);
  if (!order) return;

  await enqueueEmail({
    dedupeKey: `order:${orderId}:customer-paid`,
    storeId,
    orderId,
    kind: "customer_order_confirmed",
    recipient: order.customer_email,
    subject: `${order.store_name}: order confirmed`,
    html: `<h1>Order confirmed</h1><p>Thanks for your order from ${escapeHtml(order.store_name)}.</p><ul>${itemsHtml(order.line_items)}</ul>${totalsHtml(order)}${trackingLinkHtml(order)}`,
  });

  if (order.notification_email) {
    await enqueueEmail({
      dedupeKey: `order:${orderId}:merchant-paid`,
      storeId,
      orderId,
      kind: "merchant_new_order",
      recipient: order.notification_email,
      subject: `New paid order — ${order.store_name}`,
      html: `<h1>New paid order</h1><p>Order ${escapeHtml(order.id.slice(0, 8).toUpperCase())} has been paid.</p><ul>${itemsHtml(order.line_items)}</ul>${totalsHtml(order)}`,
    });
  }
}

export async function sendOrderShippedEmail(orderId: string, storeId: string) {
  const order = await loadOrder(orderId, storeId);
  if (!order) return;
  const tracking = order.tracking_number
    ? `<p>Tracking: ${escapeHtml(order.tracking_number)}${order.carrier ? ` (${escapeHtml(order.carrier)})` : ""}</p>`
    : "";

  await enqueueEmail({
    dedupeKey: `order:${orderId}:customer-shipped`,
    storeId,
    orderId,
    kind: "customer_order_shipped",
    recipient: order.customer_email,
    subject: `${order.store_name}: your order has shipped`,
    html: `<h1>Your order has shipped</h1>${tracking}${trackingLinkHtml(order)}`,
  });
}

export async function sendOrderDeliveredEmail(orderId: string, storeId: string) {
  const order = await loadOrder(orderId, storeId);
  if (!order) return;

  await enqueueEmail({
    dedupeKey: `order:${orderId}:customer-delivered`,
    storeId,
    orderId,
    kind: "customer_order_delivered",
    recipient: order.customer_email,
    subject: `${order.store_name}: order delivered`,
    html: `<h1>Order delivered</h1><p>Your order from ${escapeHtml(order.store_name)} has been marked delivered.</p>${trackingLinkHtml(order)}`,
  });
}

export async function sendOrderRefundEmail(orderId: string, storeId: string) {
  const order = await loadOrder(orderId, storeId);
  if (!order) return;
  const full = order.status === "refunded";

  await enqueueEmail({
    dedupeKey: `order:${orderId}:refund:${order.refunded_amount_cents}`,
    storeId,
    orderId,
    kind: full ? "customer_refund_completed" : "customer_partial_refund",
    recipient: order.customer_email,
    subject: `${order.store_name}: ${full ? "refund completed" : "partial refund completed"}`,
    html: `<h1>${full ? "Refund completed" : "Partial refund completed"}</h1><p>Refunded so far: <strong>${money(order.refunded_amount_cents)}</strong> of ${money(order.total_cents)}.</p>${trackingLinkHtml(order)}`,
  });
}
