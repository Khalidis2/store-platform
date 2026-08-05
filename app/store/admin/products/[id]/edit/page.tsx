import { notFound } from "next/navigation";
import { getCurrentStore } from "@/lib/get-store";
import { db } from "@/lib/db";
import { updateProduct } from "../../actions";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  inventory: number;
  image_url: string | null;
  description: string | null;
};

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const store = await getCurrentStore();
  if (!store) return null;

  const { id } = await params;
  const { rows } = await db.query<Product>(
    "select id, name, price_cents, inventory, image_url, description from products where id = $1 and store_id = $2",
    [id, store.id]
  );
  const product = rows[0];
  if (!product) notFound();

  return (
    <main>
      <h1>Edit product</h1>

      <form
        action={updateProduct}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 400, marginTop: "1rem" }}
      >
        <input type="hidden" name="productId" value={product.id} />
        <label>
          Name
          <input name="name" defaultValue={product.name} required style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          Price (AED)
          <input
            name="price"
            type="number"
            step="0.01"
            defaultValue={(product.price_cents / 100).toFixed(2)}
            required
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Inventory
          <input
            name="inventory"
            type="number"
            defaultValue={product.inventory}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Description (optional)
          <textarea
            name="description"
            defaultValue={product.description ?? ""}
            rows={4}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Image (optional)
          {product.image_url && (
            <div style={{ margin: "0.25rem 0" }}>
              <img src={product.image_url} alt={product.name} style={{ height: 80, borderRadius: 4 }} />
            </div>
          )}
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: "block", width: "100%" }}
          />
          <span style={{ color: "#666", fontSize: "0.8rem" }}>Leave blank to keep the current image.</span>
        </label>
        <button type="submit" style={{ alignSelf: "start" }}>
          Save
        </button>
      </form>
    </main>
  );
}
