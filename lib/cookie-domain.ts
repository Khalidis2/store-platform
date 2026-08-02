// Supabase Auth sets cookies to establish a session. For a merchant to be
// recognized on their own subdomain (khaledsstore.yourapp.com) after
// authenticating, the cookie must be scoped to the parent domain, not just
// the exact host it was set on.
//
// Update ROOT_DOMAIN once you have a real domain. Leave COOKIE_DOMAIN
// undefined in local dev (localhost cookies don't use a leading dot).
const ROOT_DOMAIN = "yourapp.com";

export const COOKIE_DOMAIN =
  process.env.NODE_ENV === "production" ? `.${ROOT_DOMAIN}` : undefined;
