import { NextRequest } from "next/server";
import { releaseStaleReservations } from "@/lib/orders";
import { cleanupExpiredRateLimits } from "@/lib/rate-limit";

const STALE_THRESHOLD_MINUTES = 45;
const RATE_LIMIT_RETENTION_HOURS = 24;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [released, rateLimitsPruned] = await Promise.all([
    releaseStaleReservations(STALE_THRESHOLD_MINUTES),
    cleanupExpiredRateLimits(RATE_LIMIT_RETENTION_HOURS),
  ]);

  return Response.json({ released, rateLimitsPruned });
}
