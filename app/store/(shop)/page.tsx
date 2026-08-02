import Link from "next/link";
import { getCurrentStore } from "@/lib/get-store";
import { db } from "@/lib/db";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
  inventory: number;
};

export default async function StorefrontHome() {
  const store = await getCurrentStore();
  if (!store) return null;

  const { rows: products } = await db.query<Product>(
    "select id, name, price_cents, image_url, inventory from products where store_id = $1 order by created_at desc",
    [store.id]
  );

  return (
    <main style={{ padding: "2rem" }}>
      {!store.is_live && (
        <p style={{ color: "#a66", background: "#fff4e5", padding: "0.5rem 1rem", borderRadius: 4 }}>
          This store is in preview mode — payments aren't wired up yet.
        </p>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1.5rem",
          marginTop: "1.5rem",
        }}
      >
        {products.map((p) => (
          <Link key={p.id} href={`/products/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} style={{ width: "100%", height: 160, objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: 160, background: "#f2f2f2" }} />
              )}
              <div style={{ padding: "0.75rem" }}>
                <div>{p.name}</div>
                <div style={{ color: "#666" }}>AED {(p.price_cents / 100).toFixed(2)}</div>
                {p.inventory <= 0 && <div style={{ color: "crimson", fontSize: "0.85rem" }}>Out of stock</div>}
              </div>
            </div>
          </Link>
        ))}
        {products.length === 0 && <p style={{ color: "#666" }}>No products yet.</p>}
      </div>
    </main>
  );
}
