import { headers } from "next/headers";
import { db } from "./db";
import { extractSubdomain } from "./subdomain";

export type Store = {
  id: string;
  subdomain: string;
  name: string;
  owner_user_id: string;
  stripe_account_id: string | null;
  is_live: boolean;
  platform_fee_percent: number | null;
  created_at: string;
};

/**
 * Resolves the current tenant. Prefers the x-store-subdomain header set by
 * middleware.ts, falling back to parsing the Host header directly — this
 * fallback is what lets API routes resolve tenant context correctly too.
 * Every store-scoped page or route should call this first, then filter all
 * subsequent queries by store.id. This function is the entire
 * tenant-isolation boundary — treat it as load-bearing.
 */
export async function getCurrentStore(): Promise<Store | null> {
  const h = headers();
  const subdomain = h.get("x-store-subdomain") ?? extractSubdomain(h.get("host") ?? "");
  if (!subdomain) return null;

  const result = await db.query<Store>(
    "select * from stores where subdomain = $1",
    [subdomain]
  );
  return result.rows[0] ?? null;
}
