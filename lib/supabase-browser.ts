import { createBrowserClient } from "@supabase/ssr";
import { COOKIE_DOMAIN } from "./cookie-domain";

export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { domain: COOKIE_DOMAIN } }
  );
}
