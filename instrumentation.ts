import { assertProductionEnv } from "@/lib/env";
import { logInfo } from "@/lib/logger";

export async function register() {
  assertProductionEnv();
  logInfo("app.startup.validated", {
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    vercel_env: process.env.VERCEL_ENV ?? null,
  });
}
