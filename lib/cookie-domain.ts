// Supabase Auth sets cookies to establish a session. For a merchant to be
// recognized on their own subdomain (khaledsstore.yourapp.com) after
// authenticating, the cookie must be scoped to the parent domain, not just
// the exact host it was set on.
import { ROOT_DOMAINS } from "./subdomain";

// The real (non-localhost) root domain — update lib/subdomain.ts's
// ROOT_DOMAINS array too when you have a real domain, both should agree.
const ROOT_DOMAIN = ROOT_DOMAINS.find((d) => d !== "localhost:3000") ?? "yourapp.com";

export const COOKIE_DOMAIN =
  process.env.NODE_ENV === "production" ? `.${ROOT_DOMAIN}` : undefined;
