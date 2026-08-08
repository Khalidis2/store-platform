import { db } from "./db";

export type ReadinessCheck = { name: string; ok: boolean };
export type ReadinessResult = { ready: boolean; checks: ReadinessCheck[] };

const REQUIRED_TABLES = ["stores", "products", "orders", "platform_admins", "audit_log", "webhook_events", "rate_limits"] as const;
const REQUIRED_COLUMNS = [
  ["stores", "notification_email"], ["stores", "status"], ["stores", "branding_configured"], ["stores", "shipping_flat_cents"], ["stores", "free_shipping_threshold_cents"], ["stores", "shipping_configured"],
  ["stores", "contact_email"], ["stores", "contact_phone"], ["stores", "shipping_policy"], ["stores", "returns_policy"], ["stores", "privacy_policy"], ["stores", "terms_policy"],
  ["products", "status"], ["orders", "public_token"], ["orders", "subtotal_cents"], ["orders", "shipping_cents"], ["orders", "refunded_amount_cents"], ["orders", "has_shipped"], ["orders", "paid_at"], ["orders", "platform_fee_percent_snapshot"], ["orders", "platform_fee_cents"],
] as const;
const REQUIRED_CONSTRAINTS = ["stores_platform_fee_percent_range_check", "stores_status_check", "stores_shipping_flat_cents_nonnegative_check", "stores_free_shipping_threshold_positive_check", "products_price_cents_nonnegative_check", "products_inventory_nonnegative_check", "products_status_check", "orders_total_cents_nonnegative_check", "orders_subtotal_cents_nonnegative_check", "orders_shipping_cents_nonnegative_check", "orders_total_matches_components_check", "orders_refunded_amount_nonnegative_check", "orders_refunded_amount_not_over_total_check", "orders_status_check", "orders_carrier_check", "orders_platform_fee_percent_snapshot_range_check", "orders_platform_fee_cents_range_check", "orders_platform_fee_snapshot_pair_check", "audit_log_actor_role_check"] as const;

export async function checkDatabaseReadiness(): Promise<ReadinessResult> {
  const checks: ReadinessCheck[] = [];
  try { await db.query("select 1"); checks.push({ name: "database", ok: true }); } catch { return { ready: false, checks: [{ name: "database", ok: false }] }; }
  const { rows: tableRows } = await db.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1::text[])", [REQUIRED_TABLES]);
  const tables = new Set(tableRows.map((row) => row.table_name));
  for (const table of REQUIRED_TABLES) checks.push({ name: `table:${table}`, ok: tables.has(table) });
  const pairs = REQUIRED_COLUMNS.map(([table, column]) => `${table}.${column}`);
  const { rows: columnRows } = await db.query<{ table_name: string; column_name: string }>("select table_name, column_name from information_schema.columns where table_schema = 'public' and (table_name || '.' || column_name) = any($1::text[])", [pairs]);
  const columns = new Set(columnRows.map((row) => `${row.table_name}.${row.column_name}`));
  for (const [table, column] of REQUIRED_COLUMNS) checks.push({ name: `column:${table}.${column}`, ok: columns.has(`${table}.${column}`) });
  const { rows: constraintRows } = await db.query<{ conname: string }>("select conname from pg_constraint where connamespace = 'public'::regnamespace and conname = any($1::text[])", [REQUIRED_CONSTRAINTS]);
  const constraints = new Set(constraintRows.map((row) => row.conname));
  for (const constraint of REQUIRED_CONSTRAINTS) checks.push({ name: `constraint:${constraint}`, ok: constraints.has(constraint) });
  return { ready: checks.every((check) => check.ok), checks };
}
