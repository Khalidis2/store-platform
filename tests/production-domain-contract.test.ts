import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const subdomainSource = fs.readFileSync(path.resolve(__dirname, "../lib/subdomain.ts"), "utf8");
const cookieSource = fs.readFileSync(path.resolve(__dirname, "../lib/cookie-domain.ts"), "utf8");
const launchDoc = fs.readFileSync(path.resolve(__dirname, "../docs/PRODUCTION_DOMAIN_LAUNCH.md"), "utf8");

describe("production domain contract", () => {
  it("does not hard-code the initial Vercel deployment hostname in routing code", () => {
    expect(subdomainSource).not.toContain("store-platform-ten.vercel.app");
    expect(cookieSource).not.toContain("store-platform-ten.vercel.app");
  });

  it("uses the canonical domain helper for tenant routing and cookie scope", () => {
    expect(subdomainSource).toContain("extractTenantSubdomain");
    expect(cookieSource).toContain("getCookieDomain");
  });

  it("documents every production integration endpoint", () => {
    expect(launchDoc).toContain("/signup/complete");
    expect(launchDoc).toContain("/api/webhooks/stripe");
    expect(launchDoc).toContain("/api/webhooks/aftership");
    expect(launchDoc).toContain("/api/health");
    expect(launchDoc).toContain("/api/ready");
  });
});
