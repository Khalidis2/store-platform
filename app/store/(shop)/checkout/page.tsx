"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";

export default function CheckoutPage() {
  const { items, subtotalCents, clear } = useCart();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, items }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Checkout failed");
      return;
    }

    const { orderId } = await res.json();
    clear();
    router.push(`/order-confirmation/${orderId}`);
  }

  if (items.length === 0) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Checkout</h1>
        <p>Your cart is empty.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 480 }}>
      <h1>Checkout</h1>
      <p style={{ color: "#a66", background: "#fff4e5", padding: "0.5rem 1rem", borderRadius: 4 }}>
        Payment collection isn't wired up yet (that's Phase 4) — placing an order now records it
        as pending, and the merchant will follow up directly to arrange payment.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <p>Subtotal: AED {(subtotalCents / 100).toFixed(2)}</p>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Placing order..." : "Place order"}
        </button>
      </form>
    </main>
  );
}
