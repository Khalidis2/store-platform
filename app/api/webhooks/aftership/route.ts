import crypto from "crypto";
import { db } from "@/lib/db";
import { markOrderDelivered } from "@/lib/orders";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("aftership-hmac-sha256");
  const secret = process.env.AFTERSHIP_WEBHOOK_SECRET;

  if (secret) {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
    if (signature !== expected) {
      return new Response("Invalid signature", { status: 401 });
    }
  }
  // If AFTERSHIP_WEBHOOK_SECRET isn't set, signature verification is
  // skipped entirely — fine for initial local testing, but set it before
  // relying on this in production, or anyone who finds this URL could feed
  // it fake "delivered" events.

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // AfterShip's webhook payload has historically wrapped the tracking
  // object under `msg`, but this can vary by API version — this checks both
  // shapes defensively. If deliveries stop working after setup, log the raw
  // payload once to confirm which shape you're actually receiving.
  const body = payload as Record<string, unknown>;
  const tracking = (body.msg ?? body.tracking ?? body) as Record<string, unknown> | undefined;
  const orderId = typeof tracking?.order_id === "string" ? tracking.order_id : null;
  const tag = typeof tracking?.tag === "string" ? tracking.tag : null;

  if (orderId && tag === "Delivered") {
    const { rows } = await db.query("select store_id from orders where id = $1", [orderId]);
    if (rows[0]) {
      await markOrderDelivered(orderId, rows[0].store_id);
    }
  }

  return Response.json({ received: true });
}
