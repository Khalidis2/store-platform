import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import {
  WEBHOOK_PROCESSING_LEASE_MINUTES,
  claimWebhookEvent,
  markWebhookFailed,
  markWebhookProcessed,
} from "@/lib/webhook-events";

describe("webhook event claims", () => {
  it("does not increment attempts for fresh-processing or processed duplicates", async () => {
    const eventId = `vitest-${randomUUID()}`;
    try {
      const firstAttempt = await claimWebhookEvent("stripe", eventId, "test.event", { value: 1 });
      expect(firstAttempt).toBe(1);
      expect(await claimWebhookEvent("stripe", eventId, "test.event", { value: 1 })).toBeNull();

      let state = await db.query("select status, attempt_count from webhook_events where provider = 'stripe' and event_id = $1", [eventId]);
      expect(state.rows[0]).toMatchObject({ status: "processing", attempt_count: 1 });

      expect(await markWebhookProcessed("stripe", eventId, firstAttempt!)).toBe(true);
      expect(await claimWebhookEvent("stripe", eventId, "test.event", { value: 1 })).toBeNull();

      state = await db.query("select status, attempt_count from webhook_events where provider = 'stripe' and event_id = $1", [eventId]);
      expect(state.rows[0]).toMatchObject({ status: "processed", attempt_count: 1 });
    } finally {
      await db.query("delete from webhook_events where provider = 'stripe' and event_id = $1", [eventId]);
    }
  });

  it("reclaims failed and stale processing attempts", async () => {
    const eventId = `vitest-${randomUUID()}`;
    try {
      const firstAttempt = await claimWebhookEvent("stripe", eventId, "test.retry", {});
      expect(firstAttempt).toBe(1);
      expect(await markWebhookFailed("stripe", eventId, firstAttempt!, new Error("temporary failure"))).toBe(true);

      const secondAttempt = await claimWebhookEvent("stripe", eventId, "test.retry", {});
      expect(secondAttempt).toBe(2);

      await db.query(
        "update webhook_events set processing_started_at = now() - (($2 + 1) || ' minutes')::interval where provider = 'stripe' and event_id = $1",
        [eventId, WEBHOOK_PROCESSING_LEASE_MINUTES]
      );
      const thirdAttempt = await claimWebhookEvent("stripe", eventId, "test.retry", {});
      expect(thirdAttempt).toBe(3);
    } finally {
      await db.query("delete from webhook_events where provider = 'stripe' and event_id = $1", [eventId]);
    }
  });

  it("fences an old worker after a stale lease is reclaimed", async () => {
    const eventId = `vitest-${randomUUID()}`;
    try {
      const oldAttempt = await claimWebhookEvent("aftership", eventId, "test.fence", {});
      await db.query(
        "update webhook_events set processing_started_at = now() - (($2 + 1) || ' minutes')::interval where provider = 'aftership' and event_id = $1",
        [eventId, WEBHOOK_PROCESSING_LEASE_MINUTES]
      );
      const newAttempt = await claimWebhookEvent("aftership", eventId, "test.fence", {});
      expect(newAttempt).toBe(2);
      expect(await markWebhookProcessed("aftership", eventId, oldAttempt!)).toBe(false);
      expect(await markWebhookFailed("aftership", eventId, oldAttempt!, new Error("late failure"))).toBe(false);
      expect(await markWebhookProcessed("aftership", eventId, newAttempt!)).toBe(true);
    } finally {
      await db.query("delete from webhook_events where provider = 'aftership' and event_id = $1", [eventId]);
    }
  });

  it("allows only one concurrent claim for a new event", async () => {
    const eventId = `vitest-${randomUUID()}`;
    try {
      const results = await Promise.all([
        claimWebhookEvent("stripe", eventId, "test.concurrent", {}),
        claimWebhookEvent("stripe", eventId, "test.concurrent", {}),
      ]);
      expect(results.filter((attempt) => attempt !== null)).toHaveLength(1);
    } finally {
      await db.query("delete from webhook_events where provider = 'stripe' and event_id = $1", [eventId]);
    }
  });
});
