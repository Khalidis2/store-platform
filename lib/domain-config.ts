export function getPlatformRootUrl(env: NodeJS.ProcessEnv = process.env): URL | null {
  const value = env.PLATFORM_ROOT_URL?.trim();
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function getCanonicalRootHost(env: NodeJS.ProcessEnv = process.env): string | null {
  return getPlatformRootUrl(env)?.host.toLowerCase() ?? null;
}

export function getRootHosts(env: NodeJS.ProcessEnv = process.env): string[] {
  const hosts = new Set<string>(["localhost:3000"]);
  const canonical = getCanonicalRootHost(env);
  if (canonical) hosts.add(canonical);

  const vercelUrl = env.VERCEL_URL?.trim().toLowerCase();
  if (vercelUrl) hosts.add(vercelUrl);

  return [...hosts];
}

function hostnameWithoutConfiguredPort(host: string, rootHost: string) {
  const rootHostname = rootHost.split(":")[0];
  const configuredPort = rootHost.slice(rootHostname.length);
  if (!configuredPort) return host;
  return host.endsWith(configuredPort) ? host.slice(0, -configuredPort.length) : host;
}

export function extractTenantSubdomain(host: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const normalized = host.trim().toLowerCase().replace(/\.$/, "");
  if (!normalized) return null;

  for (const rootHost of getRootHosts(env)) {
    if (normalized === rootHost) return null;

    const rootHostname = rootHost.split(":")[0];
    const normalizedHostname = hostnameWithoutConfiguredPort(normalized, rootHost);

    if (normalizedHostname.endsWith(`.${rootHostname}`)) {
      const prefix = normalizedHostname.slice(0, -(rootHostname.length + 1));
      if (prefix && !prefix.includes(".")) return prefix;
      return null;
    }
  }

  return null;
}

export function getCookieDomain(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.NODE_ENV !== "production") return undefined;

  const root = getPlatformRootUrl(env);
  if (!root) return undefined;
  if (root.hostname === "localhost" || root.hostname.endsWith(".localhost")) return undefined;

  return `.${root.hostname.toLowerCase()}`;
}

export function getProductionIntegrationUrls(env: NodeJS.ProcessEnv = process.env) {
  const root = getPlatformRootUrl(env);
  if (!root) return null;

  const base = root.origin;
  return {
    root: base,
    signupConfirmation: `${base}/signup/complete`,
    stripeWebhook: `${base}/api/webhooks/stripe`,
    aftershipWebhook: `${base}/api/webhooks/aftership`,
    health: `${base}/api/health`,
    readiness: `${base}/api/ready`,
    wildcardHost: `*.${root.hostname}`,
  };
}
