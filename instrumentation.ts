import { assertProductionEnv } from "@/lib/env";
import { log } from "@/lib/logger";

export async function register() {
  assertProductionEnv();
  log("info", "app.startup.validated", {
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    vercel_env: process.env.VERCEL_ENV ?? null,
  });
}
