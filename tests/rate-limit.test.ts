import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { cleanupExpiredRateLimits, getClientIp, rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  const created: Array<{ scope: string; subject: string }> = [];

  afterEach(async () => {
    for (const item of created) {
      await db.query("delete from rate_limits where scope = $1 and subject = $2", [item.scope, item.subject]);
    }
    created.length = 0;
  });

  it("allows requests up to the fixed-window limit and then blocks", async () => {
    const scope = `vitest:${randomUUID()}`;
    const subject = randomUUID();
    created.push({ scope, subject });

    expect((await rateLimit({ scope, subject, limit: 2, windowSeconds: 60 })).allowed).toBe(true);
    expect((await rateLimit({ scope, subject, limit: 2, windowSeconds: 60 })).allowed).toBe(true);

    const blocked = await rateLimit({ scope, subject, limit: 2, windowSeconds: 60 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("allows only the configured number of concurrent requests", async () => {
    const scope = `vitest:${randomUUID()}`;
    const subject = randomUUID();
    created.push({ scope, subject });

    const results = await Promise.all(
      Array.from({ length: 6 }, () => rateLimit({ scope, subject, limit: 2, windowSeconds: 60 }))
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(2);
    expect(results.filter((result) => !result.allowed)).toHaveLength(4);
  });

  it("prunes expired windows", async () => {
    const scope = `vitest:${randomUUID()}`;
    const subject = randomUUID();
    created.push({ scope, subject });

    await db.query(
      `insert into rate_limits (scope, subject, window_start, request_count)
       values ($1, $2, now() - interval '48 hours', 1)`,
      [scope, subject]
    );

    expect(await cleanupExpiredRateLimits(24)).toBeGreaterThanOrEqual(1);
    const remaining = await db.query(
      "select 1 from rate_limits where scope = $1 and subject = $2",
      [scope, subject]
    );
    expect(remaining.rowCount).toBe(0);
  });
});

describe("getClientIp", () => {
  it("ignores forwarded headers unless proxy trust is explicitly enabled", () => {
    const req = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1", "x-real-ip": "198.51.100.8" },
    });
    expect(getClientIp(req, {} as NodeJS.ProcessEnv)).toBe("unknown");
  });

  it("uses the first valid forwarded address when proxy trust is enabled", () => {
    const req = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });
    expect(getClientIp(req, { TRUST_PROXY_HEADERS: "true" } as NodeJS.ProcessEnv)).toBe("203.0.113.10");
  });

  it("skips invalid forwarded values and falls back to a valid x-real-ip", () => {
    const req = new Request("https://example.test", {
      headers: { "x-forwarded-for": "spoofed, not-an-ip", "x-real-ip": "198.51.100.8" },
    });
    expect(getClientIp(req, { TRUST_PROXY_HEADERS: "true" } as NodeJS.ProcessEnv)).toBe("198.51.100.8");
  });

  it("returns unknown when trusted headers contain no valid IP", () => {
    const req = new Request("https://example.test", {
      headers: { "x-forwarded-for": "spoofed", "x-real-ip": "also-invalid" },
    });
    expect(getClientIp(req, { TRUST_PROXY_HEADERS: "true" } as NodeJS.ProcessEnv)).toBe("unknown");
  });
});
