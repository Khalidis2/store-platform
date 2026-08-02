import { getCurrentStore } from "@/lib/get-store";
import { db } from "@/lib/db";

type Order = {
  id: string;
  customer_email: string;
  total_cents: number;
  status: string;
  created_at: string;
};

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
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%", marginTop: "1rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th>Customer</th>
            <th>Total</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{o.customer_email}</td>
              <td>AED {(o.total_cents / 100).toFixed(2)}</td>
              <td>{o.status}</td>
              <td>{new Date(o.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: "#666" }}>
                No orders yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
