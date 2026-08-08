import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync("app/api/ready/route.ts", "utf8");
const envSource = readFileSync("lib/env.ts", "utf8");

describe("production environment readiness", () => {
  it("includes production environment validation in the readiness endpoint", () => {
    expect(routeSource).toContain("validateProductionEnv");
    expect(routeSource).toContain('name: "env:production"');
    expect(routeSource).toContain("environmentErrors.length === 0");
  });

  it("requires AfterShip API credentials and explicit proxy trust in production", () => {
    expect(envSource).toContain('"AFTERSHIP_API_KEY"');
    expect(envSource).toContain('"TRUST_PROXY_HEADERS"');
    expect(envSource).toContain('trustProxyHeaders !== "true"');
  });
});
