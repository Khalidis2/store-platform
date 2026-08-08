type LogLevel = "info" | "warn" | "error";
type LogScalar = string | number | boolean | null | undefined;
type LogContext = Record<string, LogScalar>;

const SENSITIVE_KEY = /(password|secret|token|authorization|cookie|email|phone|address|card)/i;

export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") || req.headers.get("x-vercel-id") || crypto.randomUUID();
}

export function sanitizeLogContext(context: LogContext = {}) {
  return Object.fromEntries(
    Object.entries(context)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, SENSITIVE_KEY.test(key) ? "[REDACTED]" : value])
  );
}

function write(level: LogLevel, event: string, context: LogContext = {}, error?: unknown) {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizeLogContext(context),
  };

  if (error instanceof Error) {
    entry.error_name = error.name;
    entry.error_message = error.message.slice(0, 1000);
  } else if (error !== undefined) {
    entry.error_name = "UnknownError";
  }

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function logInfo(event: string, context: LogContext = {}) {
  write("info", event, context);
}

export function logWarn(event: string, context: LogContext = {}) {
  write("warn", event, context);
}

export function logError(event: string, error: unknown, context: LogContext = {}) {
  write("error", event, context, error);
}
