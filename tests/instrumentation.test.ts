import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const source = fs.readFileSync(path.resolve(__dirname, "../instrumentation.ts"), "utf8");

describe("production startup instrumentation", () => {
  it("runs production environment validation", () => {
    expect(source).toContain("assertProductionEnv()");
  });

  it("emits a startup validation event without logging environment values", () => {
    expect(source).toContain('logInfo("app.startup.validated"');
    expect(source).not.toContain("DATABASE_URL");
    expect(source).not.toContain("STRIPE_SECRET_KEY");
  });
});
