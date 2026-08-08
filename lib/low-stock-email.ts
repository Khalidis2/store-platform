import { db } from "./db";
import { LOW_STOCK_THRESHOLD } from "./inventory";
import type { LowStockAlert } from "./low-stock";
import { logError, logWarn } from "./logger";

function configured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

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
  if (!configured() || alerts.length === 0) return false;

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

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [store.notification_email],
        subject: `Low stock — ${store.name}`,
        html: `<h1>Low stock</h1><p>The following products are at or below ${LOW_STOCK_THRESHOLD} units:</p><ul>${items}</ul>${link}`,
      }),
    });

    if (!response.ok) {
      logWarn("email.delivery.failed", {
        store_id: storeId,
        email_kind: "merchant_low_stock",
        provider_status: response.status,
      });
      return false;
    }
    return true;
  } catch (err) {
    logError("email.delivery.failed", err, { store_id: storeId, email_kind: "merchant_low_stock" });
    return false;
  }
}
