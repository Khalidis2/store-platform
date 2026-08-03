import { headers } from "next/headers";
import { db } from "./db";
import { extractSubdomain } from "./subdomain";
import { getSupabaseServerClient } from "./supabase-server";

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
  const h = await headers();
  const subdomain = h.get("x-store-subdomain") ?? extractSubdomain(h.get("host") ?? "");
  if (!subdomain) return null;

  const result = await db.query<Store>(
    "select * from stores where subdomain = $1",
    [subdomain]
  );
  return result.rows[0] ?? null;
}

/**
 * Resolves the current tenant AND verifies the signed-in user actually owns
 * it. Server Actions are invocable directly (they're effectively public
 * HTTP endpoints, not gated by whatever layout.tsx happens to wrap the page
 * they're imported from) — app/store/admin/layout.tsx's owner check only
 * protects page renders, not action calls. Every store-admin Server Action
 * that mutates data must call this instead of getCurrentStore(), or any
 * signed-in merchant (owner of any store, not just this one) can invoke it
 * against a store they don't own by hitting the action directly.
 */
export async function getOwnedStore(): Promise<Store | null> {
  const store = await getCurrentStore();
  if (!store) return null;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== store.owner_user_id) return null;

  return store;
}
