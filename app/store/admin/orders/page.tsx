import { getCurrentStore } from "@/lib/get-store";
import { db } from "@/lib/db";
import { markShipped, markDelivered, refundOrder } from "./actions";
import RefundButton from "./RefundButton";
import { getCountryName } from "@/lib/countries";

type LineItem = { productId: string; name: string; priceCents: number; quantity: number };
type ShippingAddress = {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
};

type Order = {
  id: string;
  customer_email: string;
  total_cents: number;
  status: string;
  line_items: LineItem[];
  shipping_address: ShippingAddress;
  tracking_number: string | null;
  carrier: string | null;
  refunded_amount_cents: number;
  created_at: string;
};

const STATUSES = ["pending", "paid", "shipped", "delivered", "expired", "refunded", "partially_refunded"];

function carrierLabel(carrier: string | null) {
  if (carrier === "aramex") return "Aramex";
  if (carrier === "emirates_post") return "Emirates Post";
  if (carrier === "other") return "Other carrier";
  return "Carrier";
}

function statusColor(status: string) {
  if (status === "paid") return "#a66";
  if (status === "shipped") return "#2a2";
  if (status === "delivered") return "#06c";
  if (status === "expired") return "#bbb";
  if (status === "refunded") return "#c33";
  if (status === "partially_refunded") return "#c93";
  return "#888";
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; email?: string }>;
}) {
  const store = await getCurrentStore();
  if (!store) return null;

  const resolvedSearchParams = await searchParams;
  const status = resolvedSearchParams.status || "";
  const email = resolvedSearchParams.email || "";

  const conditions = ["store_id = $1"];
  const params: unknown[] = [store.id];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (email) {
    params.push(`%${email}%`);
    conditions.push(`customer_email ilike $${params.length}`);
  }

  const { rows: orders } = await db.query<Order>(
    `select * from orders where ${conditions.join(" and ")} order by created_at desc`,
    params
  );

  return (
    <main>
      <h1>Orders</h1>

      <form method="get" style={{ display: "flex", gap: "0.5rem", margin: "1rem 0", flexWrap: "wrap", alignItems: "center" }}>
        <select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <input name="email" placeholder="Search by email" defaultValue={email} />
        <button type="submit">Filter</button>
        {(status || email) && <a href="/admin/orders">Clear</a>}
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {orders.map((o) => (
          <div key={o.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <strong>{o.customer_email}</strong>
                <div style={{ color: "#666", fontSize: "0.85rem" }}>
                  {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div>AED {(o.total_cents / 100).toFixed(2)}</div>
                <div style={{ textTransform: "capitalize", color: statusColor(o.status) }}>
                  {o.status.replace("_", " ")}
                </div>
              </div>
            </div>

            <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
              {(o.line_items || []).map((item, idx) => (
                <li key={idx}>
                  {item.quantity} × {item.name} — AED {((item.priceCents * item.quantity) / 100).toFixed(2)}
                </li>
              ))}
            </ul>

            {o.shipping_address?.addressLine1 && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#666" }}>
                <strong>Ship to:</strong> {o.shipping_address.fullName}, {o.shipping_address.addressLine1}
                {o.shipping_address.addressLine2 ? `, ${o.shipping_address.addressLine2}` : ""},{" "}
                {o.shipping_address.city}, {getCountryName(o.shipping_address.country || "")} — {o.shipping_address.phone}
              </div>
            )}

            {o.status === "shipped" && o.tracking_number && (
              <div style={{ marginTop: "0.25rem", fontSize: "0.9rem" }}>
                {carrierLabel(o.carrier)} tracking: {o.tracking_number}
              </div>
            )}

            {o.status === "paid" && (
              <form action={markShipped} style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                <input type="hidden" name="orderId" value={o.id} />
                <select name="carrier" defaultValue="">
                  <option value="">Carrier (optional)</option>
                  <option value="aramex">Aramex</option>
                  <option value="emirates_post">Emirates Post</option>
                  <option value="other">Other</option>
                </select>
                <input name="trackingNumber" placeholder="Tracking number (optional)" style={{ flex: 1 }} />
                <button type="submit">Mark shipped</button>
              </form>
            )}

            {o.status === "shipped" && (
              <form action={markDelivered} style={{ marginTop: "0.5rem" }}>
                <input type="hidden" name="orderId" value={o.id} />
                <button type="submit">Mark delivered</button>
              </form>
            )}

            {o.refunded_amount_cents > 0 && (
              <div style={{ marginTop: "0.25rem", fontSize: "0.9rem", color: "#c33" }}>
                Refunded: AED {(o.refunded_amount_cents / 100).toFixed(2)}
              </div>
            )}

            {["paid", "shipped", "partially_refunded"].includes(o.status) && (
              <form
                action={refundOrder}
                style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", alignItems: "center" }}
              >
                <input type="hidden" name="orderId" value={o.id} />
                <span style={{ fontSize: "0.9rem" }}>AED</span>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={((o.total_cents - o.refunded_amount_cents) / 100).toFixed(2)}
                  defaultValue={((o.total_cents - o.refunded_amount_cents) / 100).toFixed(2)}
                  style={{ width: 90 }}
                />
                <RefundButton />
              </form>
            )}
          </div>
        ))}
        {orders.length === 0 && (
          <p style={{ color: "#666" }}>{status || email ? "No orders match this filter." : "No orders yet."}</p>
        )}
      </div>
    </main>
  );
}
