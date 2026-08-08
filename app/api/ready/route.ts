import { checkDatabaseReadiness } from "@/lib/readiness";
import { isProductionEnvironment, validateProductionEnv } from "@/lib/env";
import { logError, logInfo } from "@/lib/logger";

export async function GET() {
  try {
    const database = await checkDatabaseReadiness();
    const environmentErrors = isProductionEnvironment() ? validateProductionEnv() : [];
    const checks = [
      ...database.checks,
      { name: "env:production", ok: environmentErrors.length === 0 },
    ];
    const ready = checks.every((check) => check.ok);

    if (!ready) {
      logError("readiness.failed", new Error("Readiness checks failed"), {
        failed_checks: checks.filter((check) => !check.ok).length,
        environment_error_count: environmentErrors.length,
      });
    } else {
      logInfo("readiness.ok", { checks: checks.length });
    }

    return Response.json(
      {
        status: ready ? "ready" : "not_ready",
        checks,
      },
      {
        status: ready ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    logError("readiness.error", error);
    return Response.json(
      { status: "not_ready", checks: [{ name: "readiness", ok: false }] },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
