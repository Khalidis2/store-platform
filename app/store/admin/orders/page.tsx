import { getCurrentStore } from "@/lib/get-store";
import { db } from "@/lib/db";
import { markFulfilled } from "./actions";

type LineItem = { productId: string; name: string; priceCents: number; quantity: number };

type Order = {
  id: string;
  customer_email: string;
  total_cents: number;
  status: string;
  line_items: LineItem[];
  created_at: string;
};

function statusColor(status: string) {
  if (status === "paid") return "#a66";
  if (status === "fulfilled") return "#2a2";
  return "#888";
}

export default async function OrdersPage() {
  const store = await getCurrentStore();
  if (!store) return null;

  const { rows: orders } = await db.query<Order>(
    "select * from orders where store_id = $1 order by created_at desc",
    [store.id]
  );

  return (
    <main>
      <h1>Orders</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
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
                <div style={{ textTransform: "capitalize", color: statusColor(o.status) }}>{o.status}</div>
              </div>
            </div>

            <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
              {(o.line_items || []).map((item, idx) => (
                <li key={idx}>
                  {item.quantity} × {item.name} — AED {((item.priceCents * item.quantity) / 100).toFixed(2)}
                </li>
              ))}
            </ul>

            {o.status === "paid" && (
              <form action={markFulfilled} style={{ marginTop: "0.5rem" }}>
                <input type="hidden" name="orderId" value={o.id} />
                <button type="submit">Mark fulfilled</button>
              </form>
            )}
          </div>
        ))}
        {orders.length === 0 && <p style={{ color: "#666" }}>No orders yet.</p>}
      </div>
    </main>
  );
}
