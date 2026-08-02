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
      <h1>{order.status === "paid" ? "Payment received" : "Order received"}</h1>
      <p>
        Order #{order.id.slice(0, 8)} — AED {(order.total_cents / 100).toFixed(2)}
      </p>
      {order.status === "paid" ? (
        <p style={{ color: "#2a2" }}>Thank you! A confirmation has been sent to {order.customer_email}.</p>
      ) : (
        <p style={{ color: "#666" }}>
          Status: {order.status}. If you just completed payment and this still shows pending,
          refresh in a moment — confirmation can take a few seconds to arrive.
        </p>
      )}
    </main>
  );
}
