import { createHash } from "crypto";
import { db } from "./db";
import { enqueueEmail } from "./email-outbox";
import { LOW_STOCK_THRESHOLD } from "./inventory";
import type { LowStockAlert } from "./low-stock";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function productsUrl(subdomain: string) {
  const root = process.env.PLATFORM_ROOT_URL;
  if (!root) return null;
  try {
    const url = new URL(root);
    url.hostname = `${subdomain}.${url.hostname}`;
    url.pathname = "/admin/products";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export async function sendLowStockAlertEmail(storeId: string, alerts: LowStockAlert[]) {
  if (alerts.length === 0) return false;

  const { rows } = await db.query<{ name: string; subdomain: string; notification_email: string | null }>(
    "select name, subdomain, notification_email from stores where id = $1",
    [storeId]
  );
  const store = rows[0];
  if (!store?.notification_email) return false;

  const url = productsUrl(store.subdomain);
  const items = alerts
    .map((item) => `<li>${escapeHtml(item.name)} — ${item.inventory} unit${item.inventory === 1 ? "" : "s"} left</li>`)
    .join("");
  const link = url ? `<p><a href="${escapeHtml(url)}">Manage inventory</a></p>` : "";
  const occurrence = alerts
    .map((item) => `${item.productId}:${item.alertedAt}`)
    .sort()
    .join("|");
  const digest = createHash("sha256").update(occurrence).digest("hex").slice(0, 24);

  await enqueueEmail({
    dedupeKey: `store:${storeId}:low-stock:${digest}`,
    storeId,
    kind: "merchant_low_stock",
    recipient: store.notification_email,
    subject: `Low stock — ${store.name}`,
    html: `<h1>Low stock</h1><p>The following products are at or below ${LOW_STOCK_THRESHOLD} units:</p><ul>${items}</ul>${link}`,
  });
  return true;
}
