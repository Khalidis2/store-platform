import { captureSentryException } from "@/lib/sentry";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const MAX_MESSAGE_LENGTH = 500;
const MAX_PATH_LENGTH = 300;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = await rateLimit({
    scope: "client-error-report",
    subject: ip,
    limit: 20,
    windowSeconds: 600,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.slice(0, 100) : "ClientError";
  const message =
    typeof input.message === "string" ? input.message.slice(0, MAX_MESSAGE_LENGTH) : "Unhandled client error";
  const path = typeof input.path === "string" ? input.path.slice(0, MAX_PATH_LENGTH) : null;

  const error = new Error(message);
  error.name = name;

  await captureSentryException(error, {
    source: "browser",
    path,
  });

  return Response.json({ received: true }, { status: 202 });
}
