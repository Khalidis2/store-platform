import { getCurrentStore } from "@/lib/get-store";
import { db } from "@/lib/db";

export default async function AdminHome() {
  const store = await getCurrentStore();
  if (!store) return null;

  const {
    rows: [counts],
  } = await db.query(
    `select
       (select count(*) from products where store_id = $1) as product_count,
       (select count(*) from orders where store_id = $1) as order_count,
       (select coalesce(sum(total_cents), 0) from orders where store_id = $1 and status = 'paid') as revenue_cents`,
    [store.id]
  );

  return (
    <main>
      <h1>{store.name} — Dashboard</h1>
      <div style={{ display: "flex", gap: "3rem", marginTop: "1.5rem" }}>
        <div>
          <strong style={{ fontSize: "1.5rem" }}>{counts.product_count}</strong>
          <div style={{ color: "#666" }}>Products</div>
        </div>
        <div>
          <strong style={{ fontSize: "1.5rem" }}>{counts.order_count}</strong>
          <div style={{ color: "#666" }}>Orders</div>
        </div>
        <div>
          <strong style={{ fontSize: "1.5rem" }}>AED {(counts.revenue_cents / 100).toFixed(2)}</strong>
          <div style={{ color: "#666" }}>Revenue (paid orders)</div>
        </div>
      </div>
    </main>
  );
}
