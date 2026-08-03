// Update this when a real custom domain is added — the *.vercel.app entry
// is a placeholder until then, and Vercel's free domain can't support
// wildcard merchant subdomains anyway (only a real domain with wildcard DNS
// can), so this only unblocks the root-domain pages (signup, platform-admin)
// for now.
export const ROOT_DOMAINS = ["localhost:3000", "store-platform-ten.vercel.app"];

export function extractSubdomain(hostname: string): string | null {
  if (ROOT_DOMAINS.includes(hostname)) return null;
  return hostname.split(".")[0] || null;
}
