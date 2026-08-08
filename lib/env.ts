const REQUIRED_PRODUCTION_ENV = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "PLATFORM_ROOT_URL",
  "CRON_SECRET",
  "AFTERSHIP_API_KEY",
  "AFTERSHIP_WEBHOOK_SECRET",
  "SENTRY_DSN",
  "TRUST_PROXY_HEADERS",
] as const;

const PLACEHOLDER_VALUES = new Set([
  "changeme",
  "change-me",
  "secret",
  "password",
  "example",
  "your-secret-here",
]);

export function isProductionEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  return env.NODE_ENV === "production";
}

export function validateProductionEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const errors: string[] = [];

  for (const name of REQUIRED_PRODUCTION_ENV) {
    const value = env[name]?.trim();
    if (!value) {
      errors.push(`${name} is required`);
      continue;
    }

    if (PLACEHOLDER_VALUES.has(value.toLowerCase())) {
      errors.push(`${name} contains a placeholder value`);
    }
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      if (!["postgres:", "postgresql:"].includes(url.protocol)) {
        errors.push("DATABASE_URL must use postgres:// or postgresql://");
      }
    } catch {
      errors.push("DATABASE_URL must be a valid Postgres URL");
    }
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      if (url.protocol !== "https:") errors.push("NEXT_PUBLIC_SUPABASE_URL must use HTTPS");
    } catch {
      errors.push("NEXT_PUBLIC_SUPABASE_URL must be a valid URL");
    }
  }

  const platformRootUrl = env.PLATFORM_ROOT_URL?.trim();
  if (platformRootUrl) {
    try {
      const url = new URL(platformRootUrl);
      if (url.protocol !== "https:") errors.push("PLATFORM_ROOT_URL must use HTTPS in production");
      if (url.pathname !== "/" || url.search || url.hash) {
        errors.push("PLATFORM_ROOT_URL must be the root origin without a path, query, or hash");
      }
      if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
        errors.push("PLATFORM_ROOT_URL must use the real production domain");
      }
      if (url.hostname.endsWith(".vercel.app")) {
        errors.push("PLATFORM_ROOT_URL must use a custom production domain, not a vercel.app hostname");
      }
      if (url.hostname.startsWith("*.")) {
        errors.push("PLATFORM_ROOT_URL must be the canonical root host, not the wildcard host");
      }
    } catch {
      errors.push("PLATFORM_ROOT_URL must be a valid URL");
    }
  }

  const emailFrom = env.EMAIL_FROM?.trim();
  if (emailFrom && !emailFrom.includes("@")) {
    errors.push("EMAIL_FROM must contain a valid sender email address");
  }

  const cronSecret = env.CRON_SECRET?.trim();
  if (cronSecret && cronSecret.length < 32) {
    errors.push("CRON_SECRET must be at least 32 characters");
  }

  const sentryDsn = env.SENTRY_DSN?.trim();
  if (sentryDsn) {
    try {
      const url = new URL(sentryDsn);
      const projectId = url.pathname.split("/").filter(Boolean).at(-1);
      if (url.protocol !== "https:" || !url.username || !projectId) {
        errors.push("SENTRY_DSN must be a valid HTTPS Sentry DSN");
      }
    } catch {
      errors.push("SENTRY_DSN must be a valid HTTPS Sentry DSN");
    }
  }

  const trustProxyHeaders = env.TRUST_PROXY_HEADERS?.trim().toLowerCase();
  if (trustProxyHeaders && trustProxyHeaders !== "true") {
    errors.push("TRUST_PROXY_HEADERS must be true in production after verifying the edge proxy sanitizes forwarded IP headers");
  }

  return errors;
}

export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env) {
  if (!isProductionEnvironment(env)) return;

  const errors = validateProductionEnv(env);
  if (errors.length > 0) {
    throw new Error(`Invalid production environment:\n- ${errors.join("\n- ")}`);
  }
}
