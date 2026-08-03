import { getSupabaseServerClient } from "./supabase-server";
import { db } from "./db";

/**
 * Returns the current user only if they're a platform admin (present in the
 * platform_admins table) — not just logged in, and not the owner of any
 * particular store. Membership in this table has no self-service path; it's
 * granted by directly inserting a row via SQL.
 */
export async function getPlatformAdminUser() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { rows } = await db.query("select 1 from platform_admins where user_id = $1", [user.id]);
  if (rows.length === 0) return null;

  return user;
}
