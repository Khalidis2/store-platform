import { createHash } from "crypto";

export function stableWebhookId(providerEventId: unknown, rawBody: string) {
  if (typeof providerEventId === "string" && providerEventId.trim()) return providerEventId;
  return createHash("sha256").update(rawBody).digest("hex");
}

export function requireWebhookSecret(name: string) {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production`);
  }
  return value;
}
