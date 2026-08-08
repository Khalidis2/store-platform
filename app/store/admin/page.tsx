import Link from "next/link";
import { getCurrentStore } from "@/lib/get-store";
import { db } from "@/lib/db";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { buildMerchantOnboarding } from "@/lib/merchant-onboarding";
import { ANALYTICS_RANGES, getCommerceMetrics, money, parseAnalyticsRange } from "@/lib/analytics";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const store = await getCurrentStore();
  if (!store) return null;
  const { range: rangeParam } = await searchParams;
  const range = parseAnalyticsRange(rangeParam);

  const [{ rows: [counts] }, metrics] = await Promise.all([
    db.query(
      `select
         (select count(*) from products where store_id = $1) as product_count,
         (select count(*) from products where store_id = $1 and status = 'active') as active_product_count,
         (select count(*) from orders where store_id = $1) as order_count,
         (select count(*) from orders where store_id = $1 and status = 'paid') as needs_shipping,
         (select count(*) from products where store_id = $1 and inventory <= $2) as low_stock_count`,
      [store.id, LOW_STOCK_THRESHOLD]
    ),
    getCommerceMetrics(range, store.id),
  ]);

  const onboarding = buildMerchantOnboarding(store, Number(counts.active_product_count));
  const completedSteps = onboarding.filter((step) => step.complete).length;
  const nextStep = onboarding.find((step) => !step.complete);
  const feeCoverageComplete = metrics.feeTrackedOrderCount === metrics.orderCount;

  return (
    <main>
      <h1>{store.name} — Dashboard</h1>

      {completedSteps < onboarding.length && (
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginTop: "1rem" }}>
          <strong>Store setup: {completedSteps}/{onboarding.length}</strong>
          {nextStep && <p style={{ color: "#666" }}>Next: {nextStep.title}</p>}
          <Link href="/admin/onboarding">Continue setup</Link>
        </section>
      )}

      <section style={{ marginTop: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Sales analytics</h2>
          <nav style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }} aria-label="Analytics range">
            {ANALYTICS_RANGES.map((item) => (
              <Link key={item.value} href={item.value === "30d" ? "/admin" : `/admin?range=${item.value}`} aria-current={range === item.value ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", gap: "2.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <div><strong style={{ fontSize: "1.4rem" }}>{metrics.orderCount}</strong><div style={{ color: "#666" }}>Paid orders</div></div>
          <div><strong style={{ fontSize: "1.4rem" }}>{money(metrics.grossGmvCents)}</strong><div style={{ color: "#666" }}>GMV</div></div>
          <div><strong style={{ fontSize: "1.4rem" }}>{money(metrics.refundCents)}</strong><div style={{ color: "#666" }}>Refunds</div></div>
          <div><strong style={{ fontSize: "1.4rem" }}>{money(metrics.netSalesCents)}</strong><div style={{ color: "#666" }}>Net sales</div></div>
          <div><strong style={{ fontSize: "1.4rem" }}>{money(metrics.netPlatformFeeCents)}</strong><div style={{ color: "#666" }}>Platform fees</div></div>
          <div><strong style={{ fontSize: "1.4rem" }}>{money(metrics.merchantProceedsCents)}</strong><div style={{ color: "#666" }}>Proceeds before Stripe fees</div></div>
        </div>
        {!feeCoverageComplete && (
          <p style={{ color: "#a66", fontSize: "0.85rem" }}>
            Platform-fee analytics cover {metrics.feeTrackedOrderCount} of {metrics.orderCount} paid orders in this range. Legacy orders created before fee snapshots are excluded from fee/proceeds calculations.
          </p>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Operations</h2>
        <div style={{ display: "flex", gap: "3rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <div><strong style={{ fontSize: "1.5rem" }}>{counts.product_count}</strong><div style={{ color: "#666" }}>Products</div></div>
          <div><strong style={{ fontSize: "1.5rem" }}>{counts.order_count}</strong><div style={{ color: "#666" }}>All orders</div></div>
          <div><strong style={{ fontSize: "1.5rem", color: counts.needs_shipping > 0 ? "#a66" : undefined }}>{counts.needs_shipping}</strong><div style={{ color: "#666" }}>Needs shipping</div></div>
          <Link href="/admin/products" style={{ textDecoration: "none", color: "inherit" }}><strong style={{ fontSize: "1.5rem", color: counts.low_stock_count > 0 ? "#a66" : undefined }}>{counts.low_stock_count}</strong><div style={{ color: "#666" }}>Low stock (≤{LOW_STOCK_THRESHOLD})</div></Link>
        </div>
      </section>
    </main>
  );
}
