import { isIP } from "node:net";
import { db } from "./db";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function trustedProxyHeaders(env: NodeJS.ProcessEnv) {
  return env.TRUST_PROXY_HEADERS?.trim().toLowerCase() === "true";
}

function validIp(value: string | null | undefined) {
  const candidate = value?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

export function getClientIp(req: Request, env: NodeJS.ProcessEnv = process.env): string {
  if (!trustedProxyHeaders(env)) return "unknown";

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    for (const part of forwarded.split(",")) {
      const candidate = validIp(part);
      if (candidate) return candidate;
    }
  }

  return validIp(req.headers.get("x-real-ip")) ?? "unknown";
}

export async function rateLimit(options: {
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const { scope, subject, limit, windowSeconds } = options;
  if (limit <= 0 || windowSeconds <= 0) throw new Error("Invalid rate-limit configuration");

  const result = await db.query<{ request_count: number; retry_after_seconds: number }>(
    `with bucket as (
       select to_timestamp(floor(extract(epoch from now()) / $4) * $4) as window_start
     )
     insert into rate_limits (scope, subject, window_start, request_count)
     select $1, $2, bucket.window_start, 1
     from bucket
     on conflict (scope, subject, window_start)
     do update set request_count = rate_limits.request_count + 1
       where rate_limits.request_count < $3
     returning request_count,
       greatest(
         1,
         ceil(extract(epoch from (window_start + make_interval(secs => $4)) - now()))
       )::int as retry_after_seconds`,
    [scope, subject, limit, windowSeconds]
  );

  if (result.rowCount === 0) {
    const bucket = await db.query<{ retry_after_seconds: number }>(
      `select greatest(
         1,
         ceil(extract(epoch from (window_start + make_interval(secs => $3)) - now()))
       )::int as retry_after_seconds
       from rate_limits
       where scope = $1
         and subject = $2
         and window_start = to_timestamp(floor(extract(epoch from now()) / $3) * $3)`,
      [scope, subject, windowSeconds]
    );

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: bucket.rows[0]?.retry_after_seconds ?? windowSeconds,
    };
  }

  const count = result.rows[0].request_count;
  return {
    allowed: true,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: result.rows[0].retry_after_seconds,
  };
}

export async function cleanupExpiredRateLimits(retentionHours = 24): Promise<number> {
  if (retentionHours <= 0) throw new Error("Invalid rate-limit retention");

  const result = await db.query(
    `delete from rate_limits
     where window_start < now() - make_interval(hours => $1)`,
    [retentionHours]
  );
  return result.rowCount ?? 0;
}

export function rateLimitResponse(result: RateLimitResult) {
  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}
