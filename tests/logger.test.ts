import { describe, expect, it } from "vitest";
import { getRequestId, sanitizeLogContext } from "@/lib/logger";

describe("sanitizeLogContext", () => {
  it("redacts sensitive fields while preserving safe operational context", () => {
    expect(
      sanitizeLogContext({
        store_id: "store-1",
        order_id: "order-1",
        customer_email: "person@example.com",
        authorization: "Bearer secret",
        retry_count: 2,
      })
    ).toEqual({
      store_id: "store-1",
      order_id: "order-1",
      customer_email: "[REDACTED]",
      authorization: "[REDACTED]",
      retry_count: 2,
    });
  });
});

describe("getRequestId", () => {
  it("prefers an incoming request id", () => {
    const req = new Request("https://example.test", { headers: { "x-request-id": "req-123" } });
    expect(getRequestId(req)).toBe("req-123");
  });

  it("falls back to Vercel request id", () => {
    const req = new Request("https://example.test", { headers: { "x-vercel-id": "iad1::abc" } });
    expect(getRequestId(req)).toBe("iad1::abc");
  });
});
