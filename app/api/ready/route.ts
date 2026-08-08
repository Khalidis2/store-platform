import { checkDatabaseReadiness } from "@/lib/readiness";
import { logError, logInfo } from "@/lib/logger";

export async function GET() {
  try {
    const result = await checkDatabaseReadiness();
    if (!result.ready) {
      logError("readiness.failed", new Error("Database readiness checks failed"), {
        failed_checks: result.checks.filter((check) => !check.ok).length,
      });
    } else {
      logInfo("readiness.ok", { checks: result.checks.length });
    }

    return Response.json(
      {
        status: result.ready ? "ready" : "not_ready",
        checks: result.checks,
      },
      {
        status: result.ready ? 200 : 503,
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
