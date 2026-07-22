import { execFileAsync, ensureBundledLogin, ONCHAINOS_BIN, ONCHAINOS_ENV } from "@/lib/onchainos";
import { logger } from "@/lib/logger";

/** OKX's marketplace only controls VYRON's *listing* — online/offline status
 * is self-reported via `onchainos agent heartbeat`. GitHub Actions' schedule
 * trigger throttles sub-hourly crons unpredictably, so this gives an
 * external pinger (cron-job.org) a reliable HTTP endpoint to hit instead,
 * reusing the same bundled-binary + silent AK-login path the honeypot
 * scanner already uses in this Lambda. Chain 196 is X Layer/OKB, where
 * VYRON (#4962) is registered. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureBundledLogin();
    const { stdout } = await execFileAsync(ONCHAINOS_BIN, ["agent", "heartbeat", "--chain-index", "196"], {
      env: ONCHAINOS_ENV,
    });
    const parsed = JSON.parse(stdout) as { ok: boolean };
    if (!parsed.ok) {
      logger.error("agent_heartbeat", { stage: "agent_heartbeat", outcome: "failure", response: stdout });
      return Response.json({ ok: false }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    logger.error("agent_heartbeat", {
      stage: "agent_heartbeat",
      outcome: "failure",
      error: error instanceof Error ? error.message : String(error),
      errStderr: execError?.stderr,
      errStdout: execError?.stdout,
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}
