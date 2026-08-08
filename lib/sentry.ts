import { sanitizeLogContext } from "./logger";

type SentryContext = Record<string, string | number | boolean | null | undefined>;

function parseDsn(value: string) {
  const url = new URL(value);
  const projectId = url.pathname.split("/").filter(Boolean).at(-1);
  if (url.protocol !== "https:" || !url.username || !projectId) {
    throw new Error("SENTRY_DSN must be a valid HTTPS Sentry DSN");
  }

  return {
    endpoint: `${url.protocol}//${url.host}/api/${projectId}/store/?sentry_version=7&sentry_key=${encodeURIComponent(url.username)}&sentry_client=store-platform/1.0`,
  };
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      type: error.name || "Error",
      value: error.message.slice(0, 1000),
      stack: error.stack?.slice(0, 8000) ?? null,
    };
  }

  return {
    type: "UnknownError",
    value: String(error).slice(0, 1000),
    stack: null,
  };
}

export async function captureSentryException(
  error: unknown,
  context: SentryContext = {}
): Promise<boolean> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return false;

  let endpoint: string;
  try {
    endpoint = parseDsn(dsn).endpoint;
  } catch {
    return false;
  }

  const details = errorDetails(error);
  const event = {
    event_id: crypto.randomUUID().replaceAll("-", ""),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    logger: "store-platform",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
    exception: {
      values: [
        {
          type: details.type,
          value: details.value,
        },
      ],
    },
    extra: {
      ...sanitizeLogContext(context),
      stack: details.stack,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
