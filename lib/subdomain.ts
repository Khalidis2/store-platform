export const ROOT_DOMAINS = ["localhost:3000", "yourapp.com", "www.yourapp.com"];

export function extractSubdomain(hostname: string): string | null {
  if (ROOT_DOMAINS.includes(hostname)) return null;
  return hostname.split(".")[0] || null;
}
