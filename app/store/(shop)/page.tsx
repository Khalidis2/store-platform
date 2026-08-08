import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentStore } from "@/lib/get-store";
import { db } from "@/lib/db";
import {
  STOREFRONT_PAGE_SIZE,
  getStorefrontSortSql,
  parseStorefrontPage,
  parseStorefrontSort,
  storefrontPageHref,
} from "@/lib/storefront-catalog";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
  inventory: number;
};

export default async function StorefrontHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; page?: string }>;
}) {
  const store = await getCurrentStore();
  if (!store || store.status !== "active") notFound();

  const raw = await searchParams;
  const q = String(raw.q ?? "").trim();
  const category = String(raw.category ?? "").trim();
  const sort = parseStorefrontSort(raw.sort);
  const requestedPage = parseStorefrontPage(raw.page);

  const { rows: categories } = await db.query<{ category: string }>(
    `select distinct category
       from products
      where store_id = $1 and status = 'active' and category is not null
      order by category`,
    [store.id]
  );

  const conditions = ["store_id = $1", "status = 'active'"];
  const params: unknown[] = [store.id];
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`name ilike $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  const whereSql = conditions.join(" and ");
  const { rows: countRows } = await db.query<{ count: string }>(
    `select count(*)::text as count from products where ${whereSql}`,
    params
  );
  const totalProducts = Number(countRows[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalProducts / STOREFRONT_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * STOREFRONT_PAGE_SIZE;
  const sortSql = getStorefrontSortSql(sort);
  const productParams = [...params, STOREFRONT_PAGE_SIZE, offset];

  const { rows: products } = await db.query<Product>(
    `select id, name, price_cents, image_url, inventory
       from products
      where ${whereSql}
      order by ${sortSql}
      limit $${params.length + 1} offset $${params.length + 2}`,
    productParams
  );

  const hasFilters = Boolean(q || category || sort !== "newest");

  return (
    <main style={{ padding: "2rem" }}>
      {(categories.length > 0 || totalProducts > 0 || hasFilters) && (
        <form
          method="get"
          style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}
        >
          <input name="q" placeholder="Search products" defaultValue={q} style={{ flex: 1, minWidth: 160 }} />
          {categories.length > 0 && (
            <select name="category" defaultValue={category}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category}
                </option>
              ))}
            </select>
          )}
          <select name="sort" defaultValue={sort} aria-label="Sort products">
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
          <button type="submit">Apply</button>
          {hasFilters && <Link href="/">Clear</Link>}
        </form>
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
        {products.length === 0 && (
          <p style={{ color: "#666" }}>{q || category ? "No products match your search." : "No products yet."}</p>
        )}
      </div>

      {totalProducts > 0 && totalPages > 1 && (
        <nav
          aria-label="Product pages"
          style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "2rem" }}
        >
          {page > 1 ? (
            <Link href={storefrontPageHref({ q, category, sort, page: page - 1 })}>Previous</Link>
          ) : (
            <span style={{ color: "#999" }}>Previous</span>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={storefrontPageHref({ q, category, sort, page: page + 1 })}>Next</Link>
          ) : (
            <span style={{ color: "#999" }}>Next</span>
          )}
        </nav>
      )}
    </main>
  );
}
