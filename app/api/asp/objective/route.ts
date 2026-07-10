import { z } from "zod";
import { runExecutionEngine } from "@/lib/execution-engine";
import {
  getEscrowTransactionsByGoal,
  getGoalById,
  getLatestDelivery,
  getWorkflowTasksByGoal,
} from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/mock-data";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/** Fulfillment bridge for the "Autonomous Objective Execution" ASP service
 * registered on OKX.AI (agent #4962). Orders arrive over OKX's A2A channel,
 * not HTTP — this route exists so the agent handling that conversation can
 * turn a real order into a real, tracked VYRON goal (visible in the
 * dashboard like any other), let the already-running autonomous engine
 * execute it for real, then compile the actual per-task deliverables into
 * one report to submit back to the buyer. Nothing here is fabricated: goal
 * creation reuses the exact same `runExecutionEngine` pipeline the
 * dashboard's "New Goal" flow uses, and the compiled report is built only
 * from real, verified, already-delivered task content. */

const createSchema = z.object({
  objective: z.string().trim().min(6).max(500),
  budget: z.coerce.number().min(0).optional(),
});

const RATE_LIMIT = { max: 10, windowMs: 60_000 };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const rateLimit = checkRateLimit("asp:objective", RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many orders submitted — please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } },
    );
  }

  let finalGoalId: string | null = null;
  try {
    for await (const event of runExecutionEngine({
      userId: DEMO_USER_ID,
      title: parsed.data.objective,
      budget: parsed.data.budget,
    })) {
      if (event.stage === "error") {
        logger.error("asp_fulfillment", { stage: "objective_create", outcome: "failure", error: event.message });
        return Response.json({ error: event.message }, { status: 500 });
      }
      if (event.goal) finalGoalId = event.goal.id;
    }
  } catch (error) {
    logger.error("asp_fulfillment", {
      stage: "objective_create",
      outcome: "failure",
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Failed to create the goal." }, { status: 500 });
  }

  if (!finalGoalId) {
    return Response.json({ error: "Execution engine stopped before finishing." }, { status: 500 });
  }

  logger.info("asp_fulfillment", { stage: "objective_create", goalId: finalGoalId, outcome: "success" });
  return Response.json({ goalId: finalGoalId });
}

/** Poll this until `done: true`, then hand `compiledDeliverable` to the
 * buyer. Not done yet? `tasks` shows live per-task progress — the same
 * real status the dashboard's workflow page reads. */
export async function GET(request: Request) {
  const goalId = new URL(request.url).searchParams.get("goalId");
  if (!goalId) {
    return Response.json({ error: "goalId query param is required." }, { status: 400 });
  }

  const goal = await getGoalById(goalId);
  if (!goal) {
    return Response.json({ error: "No such goal." }, { status: 404 });
  }

  const tasks = await getWorkflowTasksByGoal(goalId);
  const done = goal.status === "completed";

  // A disputed escrow means the autonomous engine's own give-up circuit
  // breaker fired for that task (real, repeated execution/verification
  // failure — see `lib/engine/executor.ts#giveUpOnTask`) — this goal will
  // never reach "completed" on its own. Surface that honestly instead of
  // leaving the caller to poll forever.
  const escrows = await getEscrowTransactionsByGoal(goalId);
  const disputedTaskIds = new Set(
    escrows.filter((escrow) => escrow.status === "disputed").map((escrow) => escrow.taskId),
  );
  const stuckTasks = tasks.filter((task) => disputedTaskIds.has(task.id));
  const stuck = stuckTasks.length > 0;

  let compiledDeliverable: string | undefined;
  if (done) {
    const sections: string[] = [];
    for (const task of tasks.sort((a, b) => a.order - b.order)) {
      const delivery = await getLatestDelivery(task);
      if (delivery) sections.push(`## ${task.title}\n\n${delivery.deliverable}`);
    }
    compiledDeliverable = sections.join("\n\n---\n\n");
  }

  return Response.json({
    status: goal.status,
    done,
    stuck,
    stuckTasks: stuck ? stuckTasks.map((task) => task.title) : undefined,
    tasks: tasks.map((task) => ({ title: task.title, status: task.status })),
    compiledDeliverable,
  });
}
