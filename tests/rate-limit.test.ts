import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

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
});

describe("getClientIp", () => {
  it("uses the first forwarded address", () => {
    const req = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("https://example.test", {
      headers: { "x-real-ip": "198.51.100.8" },
    });
    expect(getClientIp(req)).toBe("198.51.100.8");
  });
});
