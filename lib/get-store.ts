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
  status: "draft" | "active" | "suspended" | "closed";
  platform_fee_percent: number | null;
  logo_url: string | null;
  accent_color: string | null;
  tagline: string | null;
  notification_email: string | null;
  shipping_flat_cents: number;
  free_shipping_threshold_cents: number | null;
  created_at: string;
};

export async function getCurrentStore(): Promise<Store | null> {
  const h = await headers();
  const subdomain = h.get("x-store-subdomain") ?? extractSubdomain(h.get("host") ?? "");
  if (!subdomain) return null;

  const result = await db.query<Store>("select * from stores where subdomain = $1", [subdomain]);
  return result.rows[0] ?? null;
}

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
