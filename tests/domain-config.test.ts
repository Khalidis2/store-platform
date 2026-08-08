import { describe, expect, it } from "vitest";
import {
  extractTenantSubdomain,
  getCookieDomain,
  getProductionIntegrationUrls,
  getRootHosts,
} from "@/lib/domain-config";

const productionEnv = {
  NODE_ENV: "production",
  PLATFORM_ROOT_URL: "https://shops.example.com/",
} as NodeJS.ProcessEnv;

describe("domain configuration", () => {
  it("treats the canonical root as a root request", () => {
    expect(extractTenantSubdomain("shops.example.com", productionEnv)).toBeNull();
  });

  it("extracts exactly one tenant label beneath the canonical root", () => {
    expect(extractTenantSubdomain("khaled.shops.example.com", productionEnv)).toBe("khaled");
    expect(extractTenantSubdomain("www.khaled.shops.example.com", productionEnv)).toBeNull();
  });

  it("supports localhost tenant subdomains in development", () => {
    expect(extractTenantSubdomain("demo.localhost:3000", {} as NodeJS.ProcessEnv)).toBe("demo");
  });

  it("recognizes the current Vercel deployment host as a root host", () => {
    const env = { VERCEL_URL: "preview-abc.vercel.app" } as NodeJS.ProcessEnv;
    expect(getRootHosts(env)).toContain("preview-abc.vercel.app");
    expect(extractTenantSubdomain("preview-abc.vercel.app", env)).toBeNull();
  });

  it("scopes production auth cookies to the canonical parent domain", () => {
    expect(getCookieDomain(productionEnv)).toBe(".shops.example.com");
    expect(getCookieDomain({ NODE_ENV: "development", PLATFORM_ROOT_URL: "https://shops.example.com" } as NodeJS.ProcessEnv)).toBeUndefined();
  });

  it("derives provider endpoints from one canonical root URL", () => {
    expect(getProductionIntegrationUrls(productionEnv)).toEqual({
      root: "https://shops.example.com",
      signupConfirmation: "https://shops.example.com/signup/complete",
      stripeWebhook: "https://shops.example.com/api/webhooks/stripe",
      aftershipWebhook: "https://shops.example.com/api/webhooks/aftership",
      health: "https://shops.example.com/api/health",
      readiness: "https://shops.example.com/api/ready",
      wildcardHost: "*.shops.example.com",
    });
  });
});
