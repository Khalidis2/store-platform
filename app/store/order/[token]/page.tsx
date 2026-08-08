import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentStore } from "@/lib/get-store";

type LineItem = { name: string; priceCents: number; quantity: number };
type Order = { id: string; status: string; subtotal_cents: number; discount_code: string | null; discount_cents: number; shipping_cents: number; total_cents: number; refunded_amount_cents: number; line_items: LineItem[]; tracking_number: string | null; carrier: string | null; created_at: Date };
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function statusLabel(status: string) { return status === "pending" ? "Payment pending" : status === "paid" ? "Confirmed" : status === "shipped" ? "Shipped" : status === "delivered" ? "Delivered" : status === "expired" ? "Expired" : status === "partially_refunded" ? "Partially refunded" : status === "refunded" ? "Refunded" : "Order received"; }
function carrierLabel(carrier: string | null) { if (carrier === "aramex") return "Aramex"; if (carrier === "emirates_post") return "Emirates Post"; if (carrier === "other") return "Other carrier"; return null; }

export default async function GuestOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const store = await getCurrentStore();
  if (!store) notFound();
  const { token } = await params;
  if (!UUID_V4_RE.test(token)) notFound();
  const { rows } = await db.query<Order>(`select id, status, subtotal_cents, discount_code, discount_cents, shipping_cents, total_cents, refunded_amount_cents, line_items, tracking_number, carrier, created_at from orders where store_id = $1 and public_token = $2::uuid limit 1`, [store.id, token]);
  const order = rows[0];
  if (!order) notFound();
  const carrier = carrierLabel(order.carrier);
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Order status</h1><p style={{ color: "#666" }}>Order {order.id.slice(0, 8).toUpperCase()} · {new Date(order.created_at).toLocaleDateString("en-AE")}</p>
      <section style={{ marginTop: "2rem" }}><h2>{statusLabel(order.status)}</h2>{order.status === "paid" && <p>Your payment is confirmed and the store is preparing your order.</p>}{order.status === "shipped" && <p>Your order has been shipped.</p>}{order.status === "delivered" && <p>Your order has been marked as delivered.</p>}{order.status === "expired" && <p>This checkout expired before payment was completed.</p>}</section>
      {(order.tracking_number || carrier) && <section style={{ marginTop: "2rem" }}><h2>Shipping</h2>{carrier && <p>Carrier: {carrier}</p>}{order.tracking_number && <p>Tracking number: {order.tracking_number}</p>}</section>}
      <section style={{ marginTop: "2rem" }}><h2>Items</h2><ul style={{ paddingLeft: "1.25rem" }}>{order.line_items.map((item, index) => <li key={`${item.name}-${index}`} style={{ marginBottom: "0.5rem" }}>{item.quantity} × {item.name} — AED {((item.priceCents * item.quantity) / 100).toFixed(2)}</li>)}</ul><p>Subtotal: AED {(order.subtotal_cents / 100).toFixed(2)}</p>{order.discount_cents > 0 && <p>Discount{order.discount_code ? ` (${order.discount_code})` : ""}: −AED {(order.discount_cents / 100).toFixed(2)}</p>}<p>Delivery: {order.shipping_cents === 0 ? "Free" : `AED ${(order.shipping_cents / 100).toFixed(2)}`}</p><p><strong>Total: AED {(order.total_cents / 100).toFixed(2)}</strong></p>{order.refunded_amount_cents > 0 && <p>Refunded: AED {(order.refunded_amount_cents / 100).toFixed(2)}</p>}</section>
      <p style={{ marginTop: "2rem", color: "#666", fontSize: "0.9rem" }}>Keep this private link to check your order status again later.</p>
    </main>
  );
}
