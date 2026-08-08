import { db } from "@/lib/db";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Must be signed in to create a store" }, { status: 401 });
  }

  const userLimit = await rateLimit({
    scope: "store-create:user",
    subject: user.id,
    limit: 3,
    windowSeconds: 3600,
  });
  if (!userLimit.allowed) return rateLimitResponse(userLimit);

  const ip = getClientIp(req);
  if (ip !== "unknown") {
    const ipLimit = await rateLimit({
      scope: "store-create:ip",
      subject: ip,
      limit: 10,
      windowSeconds: 3600,
    });
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit);
  }

  const { subdomain, name } = await req.json();

  if (!subdomain || !name) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const clean = String(subdomain).toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (clean !== subdomain || clean.length < 3) {
    return Response.json(
      { error: "Subdomain must be lowercase letters, numbers, hyphens, 3+ chars" },
      { status: 400 }
    );
  }

  const RESERVED = ["www", "api", "app", "admin", "mail", "static"];
  if (RESERVED.includes(clean)) {
    return Response.json({ error: "That subdomain is reserved" }, { status: 400 });
  }

  const existing = await db.query("select 1 from stores where subdomain = $1", [clean]);
  if (existing.rows.length) {
    return Response.json({ error: "Subdomain already taken" }, { status: 409 });
  }

  const result = await db.query(
    `insert into stores (subdomain, name, owner_user_id, notification_email)
     values ($1, $2, $3, $4) returning *`,
    [clean, name, user.id, user.email ?? null]
  );

  return Response.json(result.rows[0], { status: 201 });
}
