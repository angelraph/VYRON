import { executionEngine } from "@/lib/engine/executor";
import { logger } from "@/lib/logger";

/** Backstop for the autonomous engine's progress. instrumentation.ts's
 * setInterval loop only gets CPU time while a request happens to be in
 * flight on a warm Lambda instance — Vercel freezes the process between
 * invocations, so it can't be relied on alone. Vercel Cron hits this route
 * on a schedule (vercel.json) so goals keep advancing even when nobody's
 * actively polling a status endpoint. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await executionEngine.executeNextTask();
    return Response.json({ ok: true });
  } catch (error) {
    logger.error("cron_tick", {
      stage: "cron_tick",
      outcome: "failure",
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}
