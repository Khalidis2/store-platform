import type { Instrumentation } from "next";
import { assertProductionEnv } from "@/lib/env";
import { logInfo } from "@/lib/logger";
import { captureSentryException } from "@/lib/sentry";

export async function register() {
  assertProductionEnv();
  logInfo("app.startup.validated", {
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    vercel_env: process.env.VERCEL_ENV ?? null,
  });
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await captureSentryException(error, {
    source: "nextjs",
    method: request.method,
    path: request.path.split("?")[0] ?? request.path,
    router_kind: context.routerKind,
    route_path: context.routePath,
    route_type: context.routeType,
    render_source: context.renderSource ?? null,
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    digest: error.digest ?? null,
  });
};
