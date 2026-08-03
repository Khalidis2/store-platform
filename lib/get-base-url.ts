import { headers } from "next/headers";

export function getBaseUrl() {
  const h = headers();
  const host = h.get("host") || "localhost:3000";
  const hostname = host.split(":")[0];
  const isLocal = hostname === "localhost" || hostname.endsWith(".localhost");
  const protocol = isLocal ? "http" : "https";
  return `${protocol}://${host}`;
}
