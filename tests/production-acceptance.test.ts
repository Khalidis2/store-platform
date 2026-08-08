import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const runner = fs.readFileSync(
  path.resolve(__dirname, "../scripts/production-acceptance.mjs"),
  "utf8"
);
const checklist = fs.readFileSync(
  path.resolve(__dirname, "../docs/PRODUCTION_ACCEPTANCE.md"),
  "utf8"
);

describe("production acceptance gate", () => {
  it("checks liveness, readiness, signup, wildcard storefront, and webhook rejection", () => {
    expect(runner).toContain("/api/health");
    expect(runner).toContain("/api/ready");
    expect(runner).toContain("/signup");
    expect(runner).toContain("tenant storefront route");
    expect(runner).toContain("stripe webhook rejects unsigned request");
    expect(runner).toContain("aftership webhook rejects unsigned request");
  });

  it("refuses Vercel placeholder domains", () => {
    expect(runner).toContain('.hostname.endsWith(".vercel.app")');
  });

  it("keeps real external lifecycle verification as a launch blocker", () => {
    expect(checklist).toContain("Merchant lifecycle acceptance");
    expect(checklist).toContain("Customer purchase acceptance");
    expect(checklist).toContain("Fulfillment acceptance");
    expect(checklist).toContain("Refund acceptance");
    expect(checklist).toContain("External provider configuration sign-off");
    expect(checklist).toContain("No unresolved P0 defect remains");
  });
});
