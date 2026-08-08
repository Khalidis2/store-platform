import { describe, expect, it } from "vitest";
import { assertProductionEnv, isProductionEnvironment, validateProductionEnv } from "@/lib/env";

const validEnv = {
  NODE_ENV: "production",
  VERCEL_ENV: "production",
  DATABASE_URL: "postgres://user:pass@example.com:5432/app",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  STRIPE_SECRET_KEY: "sk_live_example_value",
  STRIPE_WEBHOOK_SECRET: "whsec_example_value",
  RESEND_API_KEY: "re_example_value",
  EMAIL_FROM: "Store Platform <orders@example.com>",
  PLATFORM_ROOT_URL: "https://example.com/",
  CRON_SECRET: "0123456789abcdef0123456789abcdef",
  AFTERSHIP_WEBHOOK_SECRET: "aftership-webhook-secret-value",
} as NodeJS.ProcessEnv;

describe("isProductionEnvironment", () => {
  it("uses Vercel environment when available", () => {
    expect(isProductionEnvironment({ NODE_ENV: "production", VERCEL_ENV: "preview" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isProductionEnvironment({ NODE_ENV: "production", VERCEL_ENV: "production" } as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe("validateProductionEnv", () => {
  it("accepts a complete production configuration", () => {
    expect(validateProductionEnv(validEnv)).toEqual([]);
  });

  it("reports missing critical variables", () => {
    const env = { ...validEnv, STRIPE_WEBHOOK_SECRET: "", RESEND_API_KEY: undefined };
    const errors = validateProductionEnv(env);

    expect(errors).toContain("STRIPE_WEBHOOK_SECRET is required");
    expect(errors).toContain("RESEND_API_KEY is required");
  });

  it("rejects unsafe root URLs and short cron secrets", () => {
    const env = {
      ...validEnv,
      PLATFORM_ROOT_URL: "http://example.com/app",
      CRON_SECRET: "short",
    };
    const errors = validateProductionEnv(env);

    expect(errors).toContain("PLATFORM_ROOT_URL must use HTTPS in production");
    expect(errors).toContain("PLATFORM_ROOT_URL must be the root origin without a path, query, or hash");
    expect(errors).toContain("CRON_SECRET must be at least 32 characters");
  });
});

describe("assertProductionEnv", () => {
  it("does not enforce production requirements in development or Vercel preview", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).not.toThrow();
    expect(() =>
      assertProductionEnv({ NODE_ENV: "production", VERCEL_ENV: "preview" } as NodeJS.ProcessEnv)
    ).not.toThrow();
  });

  it("throws with validation failures in production", () => {
    expect(() =>
      assertProductionEnv({ NODE_ENV: "production", PLATFORM_ROOT_URL: "http://localhost:3000" } as NodeJS.ProcessEnv)
    ).toThrow(/Invalid production environment/);
  });
});
