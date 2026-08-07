import { describe, expect, it } from "vitest";
import { stableWebhookId } from "@/lib/webhook-runtime";

describe("stableWebhookId", () => {
  it("uses the provider event id when present", () => {
    expect(stableWebhookId("evt_123", "body")).toBe("evt_123");
  });

  it("falls back to a stable body hash", () => {
    expect(stableWebhookId(null, "same-body")).toBe(stableWebhookId(undefined, "same-body"));
    expect(stableWebhookId(null, "same-body")).not.toBe(stableWebhookId(null, "different-body"));
  });
});
