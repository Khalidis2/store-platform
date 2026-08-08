import { NextRequest } from "next/server";
import { processTrackingRegistrations } from "@/lib/tracking-registration";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  return Response.json(await processTrackingRegistrations(50));
}
