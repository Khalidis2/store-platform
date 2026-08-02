"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useStoreInfo } from "@/lib/store-context";

export default function CheckoutPage() {
  const { items, subtotalCents, clear } = useCart();
  const store = useStoreInfo();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const orderRes = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, items }),
    });

    if (!orderRes.ok) {
      setSubmitting(false);
      const body = await orderRes.json();
      setError(body.error || "Checkout failed");
      return;
    }

    const { orderId } = await orderRes.json();

    const payRes = await fetch("/api/checkout/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });

    setSubmitting(false);

    if (!payRes.ok) {
      const body = await payRes.json();
      setError(body.error || "Payment setup failed");
      return;
    }

    const { url } = await payRes.json();
    clear();
    window.location.href = url;
  }

  if (items.length === 0) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Checkout</h1>
        <p>Your cart is empty.</p>
      </main>
    );
  }

  if (!store.isLive) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Checkout</h1>
        <p style={{ color: "#a66" }}>
          This store isn't set up to accept payments yet. Please check back soon.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 480 }}>
      <h1>Checkout</h1>
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
          {submitting ? "Redirecting to payment..." : "Continue to payment"}
        </button>
      </form>
    </main>
  );
}
