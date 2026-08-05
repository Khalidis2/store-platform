import { notFound } from "next/navigation";
import { getCurrentStore } from "@/lib/get-store";
import { db } from "@/lib/db";
import AddToCartButton from "./AddToCartButton";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
  inventory: number;
  description: string | null;
};

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const store = await getCurrentStore();
  if (!store) return null;

  const { id } = await params;
  const { rows } = await db.query<Product>(
    "select id, name, price_cents, image_url, inventory, description from products where id = $1 and store_id = $2",
    [id, store.id]
  );
  const product = rows[0];
  if (!product) notFound();

  return (
    <main style={{ padding: "2rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          style={{ width: 320, height: 320, objectFit: "cover", borderRadius: 8 }}
        />
      ) : (
        <div style={{ width: 320, height: 320, background: "#f2f2f2", borderRadius: 8 }} />
      )}
      <div>
        <h1>{product.name}</h1>
        <p style={{ fontSize: "1.25rem" }}>AED {(product.price_cents / 100).toFixed(2)}</p>
        {product.description && (
          <p style={{ color: "#444", whiteSpace: "pre-wrap", maxWidth: 400 }}>{product.description}</p>
        )}
        {product.inventory > 0 ? (
          <AddToCartButton productId={product.id} name={product.name} priceCents={product.price_cents} />
        ) : (
          <p style={{ color: "crimson" }}>Out of stock</p>
        )}
      </div>
    </main>
  );
}
