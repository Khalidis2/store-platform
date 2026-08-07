import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { markWebhookFailed, markWebhookProcessed, startWebhookEvent } from "@/lib/webhook-events";

describe("webhook event claims", () => {
  it("processes a new event only once and allows retry after failure", async () => {
    const eventId = `vitest-${randomUUID()}`;

    try {
      expect((await startWebhookEvent("stripe", eventId, "test.event", { value: 1 })).shouldProcess).toBe(true);
      expect((await startWebhookEvent("stripe", eventId, "test.event", { value: 1 })).shouldProcess).toBe(false);

      await markWebhookFailed("stripe", eventId, new Error("temporary failure"));
      expect((await startWebhookEvent("stripe", eventId, "test.event", { value: 1 })).shouldProcess).toBe(true);

      await markWebhookProcessed("stripe", eventId);
      expect((await startWebhookEvent("stripe", eventId, "test.event", { value: 1 })).shouldProcess).toBe(false);
    } finally {
      await db.query("delete from webhook_events where provider = 'stripe' and event_id = $1", [eventId]);
    }
  });
});
