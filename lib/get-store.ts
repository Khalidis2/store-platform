import { headers } from "next/headers";
import { db } from "./db";

export type Store = {
  id: string;
  subdomain: string;
  name: string;
  owner_user_id: string;
  stripe_account_id: string | null;
  is_live: boolean;
  created_at: string;
};

/**
 * Resolves the current tenant from the subdomain set by middleware.ts.
 * Every store-scoped page or API route should call this first, then
 * filter all subsequent queries by store.id. This function is the
 * entire tenant-isolation boundary — treat it as load-bearing.
 */
export async function getCurrentStore(): Promise<Store | null> {
  const subdomain = headers().get("x-store-subdomain");
  if (!subdomain) return null;

  const result = await db.query<Store>(
    "select * from stores where subdomain = $1",
    [subdomain]
  );
  return result.rows[0] ?? null;
}
