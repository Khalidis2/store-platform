import { NextRequest } from "next/server";
import { processEmailOutbox } from "@/lib/email-outbox";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await processEmailOutbox(50);
  return Response.json(result);
}
