import crypto from "crypto";
import { db } from "@/lib/db";
import { markOrderDelivered } from "@/lib/orders";
import { claimWebhookEvent, markWebhookFailed, markWebhookProcessed } from "@/lib/webhook-events";
import { requireWebhookSecret, stableWebhookId } from "@/lib/webhook-runtime";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("aftership-hmac-sha256");
  const secret = requireWebhookSecret("AFTERSHIP_WEBHOOK_SECRET");

  if (secret) {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
    const provided = Buffer.from(signature ?? "");
    const calculated = Buffer.from(expected);
    if (provided.length !== calculated.length || !crypto.timingSafeEqual(provided, calculated)) {
      return new Response("Invalid signature", { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const tracking = (body.msg ?? body.tracking ?? body) as Record<string, unknown> | undefined;
  const orderId = typeof tracking?.order_id === "string" ? tracking.order_id : null;
  const tag = typeof tracking?.tag === "string" ? tracking.tag : null;
  const eventId = stableWebhookId(body.event_id, rawBody);
  const eventType = typeof body.event === "string" ? body.event : `tracking.${tag ?? "unknown"}`;

  const shouldProcess = await claimWebhookEvent("aftership", eventId, eventType, payload);
  if (!shouldProcess) return Response.json({ received: true, duplicate: true });

  try {
    if (orderId && tag === "Delivered") {
      const { rows } = await db.query("select store_id from orders where id = $1", [orderId]);
      if (rows[0]) await markOrderDelivered(orderId, rows[0].store_id);
    }

    await markWebhookProcessed("aftership", eventId);
    return Response.json({ received: true });
  } catch (err) {
    try {
      await markWebhookFailed("aftership", eventId, err);
    } catch (ledgerError) {
      console.error("Failed to mark AfterShip webhook failed", ledgerError);
    }
    console.error("AfterShip webhook processing failed", { eventId, eventType, error: err });
    return new Response("Webhook processing failed", { status: 500 });
  }
}
