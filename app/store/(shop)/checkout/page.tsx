"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useStoreInfo } from "@/lib/store-context";

export default function CheckoutPage() {
  const { items, subtotalCents, clear } = useCart();
  const store = useStoreInfo();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("AE");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const shipping = { fullName, phone, addressLine1, addressLine2, city, country };

    const orderRes = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, items, shipping }),
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
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <h3 style={{ margin: "0.5rem 0 0" }}>Shipping address</h3>
        <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <input
          placeholder="Address line 1"
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          required
        />
        <input
          placeholder="Address line 2 (optional)"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
        />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} required style={{ flex: 1 }} />
          <input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} required style={{ width: 80 }} />
        </div>

        <p>Subtotal: AED {(subtotalCents / 100).toFixed(2)}</p>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Redirecting to payment..." : "Continue to payment"}
        </button>
      </form>
    </main>
  );
}
