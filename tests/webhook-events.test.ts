import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { claimWebhookEvent, markWebhookFailed, markWebhookProcessed } from "@/lib/webhook-events";

describe("webhook event claims", () => {
  it("processes a new event only once and allows retry after failure", async () => {
    const eventId = `vitest-${randomUUID()}`;

    try {
      expect(await claimWebhookEvent("stripe", eventId, "test.event", { value: 1 })).toBe(true);
      expect(await claimWebhookEvent("stripe", eventId, "test.event", { value: 1 })).toBe(false);

      await markWebhookFailed("stripe", eventId, new Error("temporary failure"));
      expect(await claimWebhookEvent("stripe", eventId, "test.event", { value: 1 })).toBe(true);

      await markWebhookProcessed("stripe", eventId);
      expect(await claimWebhookEvent("stripe", eventId, "test.event", { value: 1 })).toBe(false);
    } finally {
      await db.query("delete from webhook_events where provider = 'stripe' and event_id = $1", [eventId]);
    }
  });

  it("allows only one concurrent claim for a new event", async () => {
    const eventId = `vitest-${randomUUID()}`;

    try {
      const results = await Promise.all([
        claimWebhookEvent("stripe", eventId, "test.concurrent", {}),
        claimWebhookEvent("stripe", eventId, "test.concurrent", {}),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
    } finally {
      await db.query("delete from webhook_events where provider = 'stripe' and event_id = $1", [eventId]);
    }
  });
});
