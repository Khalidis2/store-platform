"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";

export default function AddToCartButton({
  productId,
  name,
  priceCents,
}: {
  productId: string;
  name: string;
  priceCents: number;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <button
      onClick={() => {
        addItem({ productId, name, priceCents });
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
      style={{
        background: "var(--store-accent, #111)",
        color: "#fff",
        border: "none",
        borderRadius: 4,
        padding: "0.6rem 1.25rem",
        cursor: "pointer",
      }}
    >
      {added ? "Added ✓" : "Add to cart"}
    </button>
  );
}
