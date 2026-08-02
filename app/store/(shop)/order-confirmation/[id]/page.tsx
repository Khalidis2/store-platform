import { notFound } from "next/navigation";
import { getCurrentStore } from "@/lib/get-store";
import { db } from "@/lib/db";
import { getCountryName } from "@/lib/countries";

type ShippingAddress = {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
};

export default async function OrderConfirmationPage({ params }: { params: { id: string } }) {
  const store = await getCurrentStore();
  if (!store) return null;

  const { rows } = await db.query(
    "select id, total_cents, status, customer_email, shipping_address, tracking_number from orders where id = $1 and store_id = $2",
    [params.id, store.id]
  );
  const order = rows[0];
  if (!order) notFound();

  const shipping = order.shipping_address as ShippingAddress;

  return (
    <main style={{ padding: "2rem" }}>
      <h1>{order.status === "pending" ? "Order received" : "Payment received"}</h1>
      <p>
        Order #{order.id.slice(0, 8)} — AED {(order.total_cents / 100).toFixed(2)}
      </p>

      {["paid", "shipped", "delivered"].includes(order.status) ? (
        <p style={{ color: "#2a2" }}>Thank you! A confirmation has been sent to {order.customer_email}.</p>
      ) : (
        <p style={{ color: "#666" }}>
          Status: {order.status}. If you just completed payment and this still shows pending,
          refresh in a moment — confirmation can take a few seconds to arrive.
        </p>
      )}

      {order.status === "shipped" && (
        <p>
          Shipped{order.tracking_number ? ` — tracking number: ${order.tracking_number}` : ""}.
        </p>
      )}

      {order.status === "delivered" && <p style={{ color: "#06c" }}>Delivered.</p>}

      {shipping?.addressLine1 && (
        <div style={{ marginTop: "1rem", color: "#666" }}>
          <strong>Shipping to</strong>
          <div>{shipping.fullName}</div>
          <div>{shipping.addressLine1}</div>
          {shipping.addressLine2 && <div>{shipping.addressLine2}</div>}
          <div>
            {shipping.city}, {getCountryName(shipping.country || "")}
          </div>
          <div>{shipping.phone}</div>
        </div>
      )}
    </main>
  );
}
