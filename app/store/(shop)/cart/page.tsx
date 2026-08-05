"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";

export default function CartPage() {
  const { items, updateQuantity, removeItem, subtotalCents } = useCart();

  if (items.length === 0) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Your cart</h1>
        <p>
          Your cart is empty. <Link href="/">Continue shopping</Link>
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Your cart</h1>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%", marginTop: "1rem" }}>
        <tbody>
          {items.map((item) => (
            <tr key={item.productId} style={{ borderBottom: "1px solid #eee" }}>
              <td>{item.name}</td>
              <td>AED {(item.priceCents / 100).toFixed(2)}</td>
              <td>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.productId, Number(e.target.value))}
                  style={{ width: 60 }}
                />
              </td>
              <td>AED {((item.priceCents * item.quantity) / 100).toFixed(2)}</td>
              <td>
                <button onClick={() => removeItem(item.productId)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: "1.25rem", marginTop: "1rem" }}>
        Subtotal: AED {(subtotalCents / 100).toFixed(2)}
      </p>
      <Link href="/checkout">
        <button
          style={{
            background: "var(--store-accent, #111)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "0.6rem 1.25rem",
            cursor: "pointer",
          }}
        >
          Proceed to checkout
        </button>
      </Link>
    </main>
  );
}
