import { extractTenantSubdomain, getRootHosts } from "./domain-config";

export const ROOT_DOMAINS = getRootHosts();

export function extractSubdomain(hostname: string): string | null {
  return extractTenantSubdomain(hostname);
}
