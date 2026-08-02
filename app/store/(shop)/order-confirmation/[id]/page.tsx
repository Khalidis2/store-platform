import { notFound } from "next/navigation";
import { getCurrentStore } from "@/lib/get-store";
import { db } from "@/lib/db";

export default async function OrderConfirmationPage({ params }: { params: { id: string } }) {
  const store = await getCurrentStore();
  if (!store) return null;

  const { rows } = await db.query(
    "select id, total_cents, status, customer_email from orders where id = $1 and store_id = $2",
    [params.id, store.id]
  );
  const order = rows[0];
  if (!order) notFound();

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Order received</h1>
      <p>
        Order #{order.id.slice(0, 8)} — AED {(order.total_cents / 100).toFixed(2)}
      </p>
      <p style={{ color: "#666" }}>
        Status: {order.status}. The merchant will be in touch at {order.customer_email} to
        arrange payment and delivery.
      </p>
    </main>
  );
}
