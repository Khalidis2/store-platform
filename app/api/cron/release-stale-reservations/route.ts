import { NextRequest } from "next/server";
import { releaseStaleReservations } from "@/lib/orders";

// Comfortably longer than the 31-minute Checkout Session expiry, so this
// never races against a session that's still legitimately in progress.
const STALE_THRESHOLD_MINUTES = 45;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  // Works for both Vercel's own cron (which signs requests with this header
  // automatically once CRON_SECRET is set) and an external scheduler like a
  // GitHub Actions workflow, as long as it sends the same header.
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const released = await releaseStaleReservations(STALE_THRESHOLD_MINUTES);

  return Response.json({ released });
}
