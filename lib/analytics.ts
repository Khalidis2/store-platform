import { db } from "./db";

export type AnalyticsRange = "today" | "7d" | "30d" | "all";

export type CommerceMetrics = {
  orderCount: number;
  grossGmvCents: number;
  refundCents: number;
  netSalesCents: number;
  grossPlatformFeeCents: number;
  refundedPlatformFeeCents: number;
  netPlatformFeeCents: number;
  merchantProceedsCents: number;
  feeTrackedOrderCount: number;
};

export const ANALYTICS_RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

export function parseAnalyticsRange(value: string | undefined): AnalyticsRange {
  if (value === "today" || value === "7d" || value === "all") return value;
  return "30d";
}

export function analyticsRangeSql(range: AnalyticsRange) {
  if (range === "today") {
    return "paid_at >= (date_trunc('day', now() at time zone 'Asia/Dubai') at time zone 'Asia/Dubai')";
  }
  if (range === "7d") return "paid_at >= now() - interval '7 days'";
  if (range === "30d") return "paid_at >= now() - interval '30 days'";
  return "true";
}

export async function getCommerceMetrics(range: AnalyticsRange, storeId?: string): Promise<CommerceMetrics> {
  const conditions = ["paid_at is not null", analyticsRangeSql(range)];
  const params: unknown[] = [];
  if (storeId) {
    params.push(storeId);
    conditions.push(`store_id = $${params.length}`);
  }

  const { rows } = await db.query(
    `select
       count(*)::int as order_count,
       coalesce(sum(total_cents), 0)::bigint as gross_gmv_cents,
       coalesce(sum(refunded_amount_cents), 0)::bigint as refund_cents,
       coalesce(sum(total_cents - refunded_amount_cents), 0)::bigint as net_sales_cents,
       coalesce(sum(platform_fee_cents), 0)::bigint as gross_platform_fee_cents,
       coalesce(sum(
         case
           when platform_fee_cents is null or total_cents = 0 then 0
           else round(platform_fee_cents::numeric * refunded_amount_cents::numeric / total_cents::numeric)
         end
       ), 0)::bigint as refunded_platform_fee_cents,
       count(platform_fee_cents)::int as fee_tracked_order_count
     from orders
     where ${conditions.join(" and ")}`,
    params
  );

  const row = rows[0] ?? {};
  const grossGmvCents = Number(row.gross_gmv_cents ?? 0);
  const refundCents = Number(row.refund_cents ?? 0);
  const netSalesCents = Number(row.net_sales_cents ?? 0);
  const grossPlatformFeeCents = Number(row.gross_platform_fee_cents ?? 0);
  const refundedPlatformFeeCents = Number(row.refunded_platform_fee_cents ?? 0);
  const netPlatformFeeCents = grossPlatformFeeCents - refundedPlatformFeeCents;

  return {
    orderCount: Number(row.order_count ?? 0),
    grossGmvCents,
    refundCents,
    netSalesCents,
    grossPlatformFeeCents,
    refundedPlatformFeeCents,
    netPlatformFeeCents,
    merchantProceedsCents: netSalesCents - netPlatformFeeCents,
    feeTrackedOrderCount: Number(row.fee_tracked_order_count ?? 0),
  };
}

export function money(cents: number) {
  return `AED ${(cents / 100).toFixed(2)}`;
}
