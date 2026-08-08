import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const sentry = fs.readFileSync(path.resolve(__dirname, "../lib/sentry.ts"), "utf8");
const instrumentation = fs.readFileSync(path.resolve(__dirname, "../instrumentation.ts"), "utf8");
const clientInstrumentation = fs.readFileSync(
  path.resolve(__dirname, "../instrumentation-client.ts"),
  "utf8"
);
const clientRoute = fs.readFileSync(
  path.resolve(__dirname, "../app/api/client-errors/route.ts"),
  "utf8"
);

describe("Sentry monitoring", () => {
  it("captures Next.js server request errors through instrumentation", () => {
    expect(instrumentation).toContain("onRequestError");
    expect(instrumentation).toContain("captureSentryException");
  });

  it("reports browser errors without query strings or raw rejection payloads", () => {
    expect(clientInstrumentation).toContain("window.location.pathname");
    expect(clientInstrumentation).not.toContain("window.location.search");
    expect(clientInstrumentation).toContain('"Unhandled promise rejection"');
  });

  it("rate limits the public client error endpoint", () => {
    expect(clientRoute).toContain('scope: "client-error-report"');
    expect(clientRoute).toContain("rateLimitResponse");
  });

  it("uses the Sentry DSN ingest endpoint and sanitizes context", () => {
    expect(sentry).toContain("sentry_version=7");
    expect(sentry).toContain("sanitizeLogContext(context)");
    expect(sentry).not.toContain("SENTRY_AUTH_TOKEN");
  });
});
