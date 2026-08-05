import { getCurrentStore } from "@/lib/get-store";
import { db } from "@/lib/db";
import { createProduct, deleteProduct, updateInventory } from "./actions";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  inventory: number;
  image_url: string | null;
};

export default async function ProductsPage() {
  const store = await getCurrentStore();
  if (!store) return null;

  const { rows: products } = await db.query<Product>(
    "select * from products where store_id = $1 order by created_at desc",
    [store.id]
  );

  return (
    <main>
      <h1>Products</h1>

      <form
        action={createProduct}
        style={{ display: "flex", gap: "0.5rem", margin: "1.5rem 0", flexWrap: "wrap" }}
      >
        <input name="name" placeholder="Product name" required />
        <input name="price" type="number" step="0.01" placeholder="Price (AED)" required />
        <input name="inventory" type="number" placeholder="Inventory" defaultValue={0} />
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif" />
        <button type="submit">Add product</button>
      </form>

      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th></th>
            <th>Name</th>
            <th>Price</th>
            <th>Inventory</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }} />
                ) : (
                  <div style={{ width: 40, height: 40, background: "#f2f2f2", borderRadius: 4 }} />
                )}
              </td>
              <td>{p.name}</td>
              <td>AED {(p.price_cents / 100).toFixed(2)}</td>
              <td>
                <form action={updateInventory} style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                  <input type="hidden" name="productId" value={p.id} />
                  <input name="inventory" type="number" defaultValue={p.inventory} style={{ width: 70 }} />
                  <button type="submit">Update</button>
                  {p.inventory === 0 ? (
                    <span style={{ color: "crimson", fontSize: "0.8rem" }}>Out of stock</span>
                  ) : p.inventory <= LOW_STOCK_THRESHOLD ? (
                    <span style={{ color: "#a66", fontSize: "0.8rem" }}>Low stock</span>
                  ) : null}
                </form>
              </td>
              <td>
                <form action={deleteProduct}>
                  <input type="hidden" name="productId" value={p.id} />
                  <button type="submit">Delete</button>
                </form>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={5} style={{ color: "#666" }}>
                No products yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
