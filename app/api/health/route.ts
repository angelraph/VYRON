import { getPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const DB_CHECK_TIMEOUT_MS = 3000;

async function checkDatabase(): Promise<{ status: "ok" | "error"; latencyMs?: number; error?: string }> {
  const startedAt = Date.now();
  try {
    const prisma = await getPrisma();
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database check timed out")), DB_CHECK_TIMEOUT_MS),
      ),
    ]);
    return { status: "ok", latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Cheap presence check only — deliberately doesn't make a real OpenAI
 * call on every health-check poll (that would cost money and add a
 * third-party dependency to an endpoint meant to be cheap and reliable). */
function checkOpenAiConfig(): { status: "ok" | "unconfigured"; model: string } {
  return {
    status: process.env.OPENAI_API_KEY ? "ok" : "unconfigured",
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  };
}

export async function GET() {
  const [database, openai] = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkOpenAiConfig()),
  ]);

  const healthy = database.status === "ok";
  const degraded = healthy && openai.status !== "ok";

  if (!healthy) {
    logger.error("health_check", {
      stage: "health_check",
      outcome: "failure",
      database: database.status,
      openai: openai.status,
    });
  }

  const body = {
    status: healthy ? (degraded ? "degraded" : "healthy") : "unhealthy",
    timestamp: new Date().toISOString(),
    checks: { database, openai },
  };

  return Response.json(body, { status: healthy ? 200 : 503 });
}
