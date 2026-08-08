import Link from "next/link";
import { db } from "@/lib/db";
import { ANALYTICS_RANGES, getCommerceMetrics, money, parseAnalyticsRange } from "@/lib/analytics";
import { setPlatformStoreStatus, updateStoreFee } from "./actions";

const DEFAULT_FEE_PERCENT = 5;

type Store = {
  id: string;
  name: string;
  subdomain: string;
  is_live: boolean;
  status: "draft" | "active" | "suspended" | "closed";
  platform_fee_percent: number | null;
};

export default async function PlatformAdminHome({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range = parseAnalyticsRange(rangeParam);
  const [{ rows: stores }, metrics] = await Promise.all([
    db.query<Store>("select id, name, subdomain, is_live, status, platform_fee_percent from stores order by created_at desc"),
    getCommerceMetrics(range),
  ]);

  const activeStores = stores.filter((store) => store.status === "active").length;
  const restrictedStores = stores.filter((store) => store.status === "suspended" || store.status === "closed").length;
  const feeCoverageComplete = metrics.feeTrackedOrderCount === metrics.orderCount;

  return (
    <main>
      <h1>Platform dashboard</h1>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Commerce analytics</h2>
          <nav style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }} aria-label="Analytics range">
            {ANALYTICS_RANGES.map((item) => (
              <Link key={item.value} href={item.value === "30d" ? "/platform-admin" : `/platform-admin?range=${item.value}`} aria-current={range === item.value ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", gap: "2.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <div><strong style={{ fontSize: "1.4rem" }}>{stores.length}</strong><div style={{ color: "#666" }}>Merchants</div></div>
          <div><strong style={{ fontSize: "1.4rem" }}>{activeStores}</strong><div style={{ color: "#666" }}>Active stores</div></div>
          <div><strong style={{ fontSize: "1.4rem" }}>{restrictedStores}</strong><div style={{ color: "#666" }}>Restricted stores</div></div>
          <div><strong style={{ fontSize: "1.4rem" }}>{metrics.orderCount}</strong><div style={{ color: "#666" }}>Paid orders</div></div>
          <div><strong style={{ fontSize: "1.4rem" }}>{money(metrics.grossGmvCents)}</strong><div style={{ color: "#666" }}>GMV</div></div>
          <div><strong style={{ fontSize: "1.4rem" }}>{money(metrics.refundCents)}</strong><div style={{ color: "#666" }}>Refunds</div></div>
          <div><strong style={{ fontSize: "1.4rem" }}>{money(metrics.netSalesCents)}</strong><div style={{ color: "#666" }}>Net sales</div></div>
          <div><strong style={{ fontSize: "1.4rem" }}>{money(metrics.netPlatformFeeCents)}</strong><div style={{ color: "#666" }}>Platform revenue</div></div>
        </div>
        {!feeCoverageComplete && (
          <p style={{ color: "#a66", fontSize: "0.85rem" }}>
            Platform-fee analytics cover {metrics.feeTrackedOrderCount} of {metrics.orderCount} paid orders in this range. Legacy orders without a fee snapshot are excluded from platform revenue.
          </p>
        )}
      </section>

      <section style={{ marginTop: "2.5rem" }}>
        <h2>Stores</h2>
        <p style={{ color: "#666" }}>
          Blank fee defaults to {DEFAULT_FEE_PERCENT}%. Suspended and closed stores cannot accept storefront orders.
        </p>
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%", marginTop: "1rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th>Store</th>
              <th>Subdomain</th>
              <th>Status</th>
              <th>Stripe ready</th>
              <th>Fee %</th>
              <th>Lifecycle</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{s.name}</td>
                <td>{s.subdomain}</td>
                <td><strong>{s.status}</strong></td>
                <td>{s.is_live ? "Yes" : "No"}</td>
                <td>
                  <form action={updateStoreFee} style={{ display: "flex", gap: "0.5rem" }}>
                    <input type="hidden" name="storeId" value={s.id} />
                    <input name="feePercent" type="number" step="0.1" min="0" max="100" placeholder={String(DEFAULT_FEE_PERCENT)} defaultValue={s.platform_fee_percent ?? ""} style={{ width: 70 }} />
                    <button type="submit">Save</button>
                  </form>
                </td>
                <td>
                  {s.status === "suspended" || s.status === "closed" ? (
                    <form action={setPlatformStoreStatus}>
                      <input type="hidden" name="storeId" value={s.id} />
                      <input type="hidden" name="status" value="draft" />
                      <button type="submit">Reopen as draft</button>
                    </form>
                  ) : (
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <form action={setPlatformStoreStatus}><input type="hidden" name="storeId" value={s.id} /><input type="hidden" name="status" value="suspended" /><button type="submit">Suspend</button></form>
                      <form action={setPlatformStoreStatus}><input type="hidden" name="storeId" value={s.id} /><input type="hidden" name="status" value="closed" /><button type="submit">Close</button></form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {stores.length === 0 && <tr><td colSpan={6} style={{ color: "#666" }}>No stores yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
