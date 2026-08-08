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
  "AFTERSHIP_WEBHOOK_SECRET",
] as const;

const PLACEHOLDER_VALUES = new Set([
  "changeme",
  "change-me",
  "secret",
  "password",
  "example",
  "your-secret-here",
]);

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

  return errors;
}

export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production" && env.VERCEL_ENV !== "production") return;

  const errors = validateProductionEnv(env);
  if (errors.length > 0) {
    throw new Error(`Invalid production environment:\n- ${errors.join("\n- ")}`);
  }
}
