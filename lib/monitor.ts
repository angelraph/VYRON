import "server-only";
import { matchAgentForTask } from "@/lib/ai/agent-matcher";
import { executeTask } from "@/lib/ai/task-executor";
import { verifyTask } from "@/lib/ai/task-verifier";
import { formatDeliveryMessage } from "@/lib/ai/delivery-format";
import { getEscrowProvider } from "@/lib/escrow";
import { logger } from "@/lib/logger";
import {
  disputeEscrow,
  getActiveTasks,
  getAgentAffinityMap,
  getAgents,
  getDependencyDeliverables,
  getGoalById,
  getLatestDelivery,
  getLockedEscrowForTask,
  getUserPreferences,
  getWorkflowTasksByGoal,
  logActivityEvent,
  markGoalCompleted,
  reassignTask,
  updateTask,
} from "@/lib/db";
import type { Agent, WorkflowTask } from "@/lib/types";

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** For log fields only — the actual model selection lives independently in
 * `lib/ai/task-executor.ts` and `lib/ai/task-verifier.ts`; this just mirrors
 * their fallback so logs report what was really used. */
const MODEL_NAME = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

/** Consecutive execution failures tolerated (same agent) before self-heal
 * reassignment kicks in. Process-local — a restart mid-run simply resets
 * the count, which just means one more genuine retry, not a correctness
 * issue. */
const MAX_EXECUTION_ATTEMPTS = 2;
/** Rejected-verification regenerations tolerated (same agent) before
 * self-heal reassignment kicks in. */
const MAX_REGEN_ATTEMPTS = 2;

/** Tasks with a real LLM call (execution or verification) currently in
 * flight — guards against a slow call still running when the next tick
 * fires (ticks are fire-and-forget every 4s; a model round trip can take
 * longer than that). Process-local by design, same pattern as the
 * existing Prisma-singleton and monitor-startup guards elsewhere. */
const inFlightExecutions = new Set<string>();
const inFlightVerifications = new Set<string>();

const executionFailures = new Map<string, number>();
const regenerationAttempts = new Map<string, number>();
const pendingRevisionFeedback = new Map<string, string>();
const hasSelfHealed = new Set<string>();
const givenUp = new Set<string>();

/** One tick of the autonomous monitor: the piece of VYRON that keeps
 * working without anyone clicking anything. Every task actually in flight
 * (running or in review) either gets a real deliverable generated for it,
 * or that deliverable independently reviewed — nothing here advances on a
 * timer. Failures are handled the same way a real worker failing would be:
 * bounded retry, then reassignment, then (if reassignment doesn't help
 * either) the escrow is flagged for human review rather than the task
 * silently completing. */
export async function runMonitorTick(): Promise<void> {
  const activeTasks = await getActiveTasks();
  if (activeTasks.length === 0) return;

  const agents = await getAgents();
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const escrowProvider = getEscrowProvider();
  const touchedGoalIds = new Set<string>();

  await Promise.allSettled(
    activeTasks.map(async (task) => {
      const agent = task.agentId ? agentsById.get(task.agentId) : undefined;

      if (task.status === "running") {
        await handleRunningTask(task, agent, agents, touchedGoalIds);
      } else if (task.status === "review") {
        await handleReviewTask(task, agent, agents, escrowProvider, touchedGoalIds);
      }
    }),
  );

  for (const goalId of touchedGoalIds) {
    await activateReadyDependents(goalId, agentsById, escrowProvider);
    await maybeCompleteGoal(goalId);
  }
}

/** Runs the actual execution model call for a task that's running and has
 * no delivery yet, and records the result. On failure, retries a bounded
 * number of times before handing off to self-heal reassignment — a real
 * failure signal, not a fabricated stall timer. */
async function handleRunningTask(
  task: WorkflowTask,
  agent: Agent | undefined,
  agents: Agent[],
  touchedGoalIds: Set<string>,
): Promise<void> {
  if (!task.agentId || !agent) return;
  if (inFlightExecutions.has(task.id) || givenUp.has(task.id)) return;

  inFlightExecutions.add(task.id);
  const startedAt = Date.now();
  try {
    const goal = await getGoalById(task.goalId);
    if (!goal) return;

    const dependencyOutputs = await getDependencyDeliverables(task);
    const revisionFeedback = pendingRevisionFeedback.get(task.id);

    const result = await executeTask({
      goalTitle: goal.title,
      task,
      agent,
      dependencyOutputs,
      revisionFeedback,
    });

    const now = new Date().toISOString();
    await updateTask(task.id, { status: "review", reviewStartedAt: now });
    await logActivityEvent({
      id: newId("evt"),
      type: "task_delivered",
      message: formatDeliveryMessage(agent.name, task.title, result.summary, result.deliverable),
      createdAt: now,
      goalId: task.goalId,
      agentId: task.agentId,
    });

    logger.info("task_execution", {
      goalId: task.goalId,
      taskId: task.id,
      agentId: task.agentId,
      stage: "execution",
      model: MODEL_NAME,
      durationMs: Date.now() - startedAt,
      outcome: "success",
    });

    pendingRevisionFeedback.delete(task.id);
    executionFailures.delete(task.id);
    touchedGoalIds.add(task.goalId);
  } catch (error) {
    logger.error("task_execution", {
      goalId: task.goalId,
      taskId: task.id,
      agentId: task.agentId,
      stage: "execution",
      model: MODEL_NAME,
      durationMs: Date.now() - startedAt,
      outcome: "failure",
      error: error instanceof Error ? error.message : String(error),
    });
    await handleExecutionFailure(task, agent, agents);
  } finally {
    inFlightExecutions.delete(task.id);
  }
}

async function handleExecutionFailure(
  task: WorkflowTask,
  agent: Agent | undefined,
  agents: Agent[],
): Promise<void> {
  const failures = (executionFailures.get(task.id) ?? 0) + 1;
  executionFailures.set(task.id, failures);
  if (failures < MAX_EXECUTION_ATTEMPTS) return;

  if (!hasSelfHealed.has(task.id)) {
    await selfHealTask(
      task,
      agent,
      agents,
      `${agent?.name ?? "The assigned agent"} failed to deliver after ${MAX_EXECUTION_ATTEMPTS} attempts — VYRON reassigned it autonomously`,
    );
    hasSelfHealed.add(task.id);
    executionFailures.delete(task.id);
    return;
  }

  await giveUpOnTask(task, "execution kept failing even after reassignment");
}

/** Runs the verification model call for a task in review, and acts on the
 * real verdict: approve → settle (release escrow); reject → regenerate
 * with the reviewer's actual feedback (bounded), then reassign, then (if
 * that still doesn't help) dispute the escrow for human review. */
async function handleReviewTask(
  task: WorkflowTask,
  agent: Agent | undefined,
  agents: Agent[],
  escrowProvider: ReturnType<typeof getEscrowProvider>,
  touchedGoalIds: Set<string>,
): Promise<void> {
  if (inFlightVerifications.has(task.id) || givenUp.has(task.id)) return;

  inFlightVerifications.add(task.id);
  const startedAt = Date.now();
  try {
    const goal = await getGoalById(task.goalId);
    if (!goal) return;

    const delivery = await getLatestDelivery(task);
    if (!delivery) return;

    const verdict = await verifyTask({
      goalTitle: goal.title,
      task,
      deliverable: delivery.deliverable,
    });
    const now = new Date().toISOString();
    const durationMs = Date.now() - startedAt;

    if (verdict.approved) {
      await logActivityEvent({
        id: newId("evt"),
        type: "task_verified",
        message: `Verified "${task.title}" — quality ${verdict.qualityScore}/100, approved: ${verdict.feedback}`,
        createdAt: now,
        goalId: task.goalId,
        agentId: task.agentId,
      });
      logger.info("task_verification", {
        goalId: task.goalId,
        taskId: task.id,
        agentId: task.agentId,
        stage: "verification",
        model: MODEL_NAME,
        durationMs,
        outcome: "approved",
        qualityScore: verdict.qualityScore,
      });
      await settleTask(task.id, task.goalId, task.title, task.price, task.agentId, agent, escrowProvider);
      regenerationAttempts.delete(task.id);
      touchedGoalIds.add(task.goalId);
      return;
    }

    await logActivityEvent({
      id: newId("evt"),
      type: "task_verified",
      message: `Review of "${task.title}" — needs revision (quality ${verdict.qualityScore}/100): ${verdict.feedback}`,
      createdAt: now,
      goalId: task.goalId,
      agentId: task.agentId,
    });
    logger.info("task_verification", {
      goalId: task.goalId,
      taskId: task.id,
      agentId: task.agentId,
      stage: "verification",
      model: MODEL_NAME,
      durationMs,
      outcome: "rejected",
      qualityScore: verdict.qualityScore,
    });

    const attempts = (regenerationAttempts.get(task.id) ?? 0) + 1;
    regenerationAttempts.set(task.id, attempts);

    if (attempts <= MAX_REGEN_ATTEMPTS) {
      pendingRevisionFeedback.set(task.id, verdict.feedback);
      await updateTask(task.id, { status: "running" });
      return;
    }

    if (!hasSelfHealed.has(task.id)) {
      await updateTask(task.id, { status: "running" });
      await selfHealTask(
        task,
        agent,
        agents,
        `${agent?.name ?? "The assigned agent"}'s work didn't pass review after ${MAX_REGEN_ATTEMPTS} revisions — VYRON reassigned it autonomously`,
      );
      hasSelfHealed.add(task.id);
      regenerationAttempts.delete(task.id);
      return;
    }

    await giveUpOnTask(task, "repeated review rejections even after reassignment");
  } catch (error) {
    logger.error("task_verification", {
      goalId: task.goalId,
      taskId: task.id,
      agentId: task.agentId,
      stage: "verification",
      model: MODEL_NAME,
      durationMs: Date.now() - startedAt,
      outcome: "failure",
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    inFlightVerifications.delete(task.id);
  }
}

/** Detected from a real failure, not a click: re-runs real matching
 * (excluding the underperforming agent, honoring the goal owner's memory)
 * and reassigns — same mechanics as manually forcing an agent offline. */
async function selfHealTask(
  task: WorkflowTask,
  stalledAgent: Agent | undefined,
  agents: Agent[],
  reason: string,
): Promise<void> {
  const goal = await getGoalById(task.goalId);
  if (!goal) return;

  const candidates = agents.filter((candidate) => candidate.id !== task.agentId);
  const [preferences, affinity] = await Promise.all([
    getUserPreferences(goal.userId),
    getAgentAffinityMap(goal.userId),
  ]);
  const match = matchAgentForTask(candidates, task.specialization, undefined, {
    favoriteAgentIds: preferences.favoriteAgentIds,
    affinity,
  });
  if (!match.agent) return;

  await reassignTask({
    taskId: task.id,
    goalId: task.goalId,
    newAgentId: match.agent.id,
    trustScore: match.trustScore,
    rationale: match.rationale,
    reason,
  });

  logger.warn("task_self_heal", {
    goalId: task.goalId,
    taskId: task.id,
    agentId: match.agent.id,
    stage: "self_heal",
    outcome: "success",
    previousAgentId: stalledAgent?.id ?? task.agentId,
    reason,
  });
}

/** Terminal state for a task VYRON can't move forward autonomously —
 * disputes any locked escrow (an existing, previously-unused status) and
 * stops further auto-retry, rather than silently completing or endlessly
 * re-calling a model that keeps failing. */
async function giveUpOnTask(task: WorkflowTask, reason: string): Promise<void> {
  givenUp.add(task.id);
  const escrow = await getLockedEscrowForTask(task.id);
  if (escrow) await disputeEscrow(escrow.id);
  logger.error("task_give_up", {
    goalId: task.goalId,
    taskId: task.id,
    agentId: task.agentId,
    stage: "give_up",
    outcome: "failure",
    reason,
  });
}

async function settleTask(
  taskId: string,
  goalId: string,
  taskTitle: string,
  price: number,
  agentId: string | null,
  agent: Agent | undefined,
  escrowProvider: ReturnType<typeof getEscrowProvider>,
): Promise<void> {
  const now = new Date().toISOString();
  await updateTask(taskId, { status: "paid" });

  const escrow = agentId ? await getLockedEscrowForTask(taskId) : null;
  if (escrow) {
    const released = await escrowProvider.release(escrow.id);
    await logActivityEvent({
      id: newId("evt"),
      type: "escrow_released",
      message: `Escrow released to ${agent?.name ?? "agent"} for ${taskTitle} ($${price})`,
      createdAt: now,
      goalId,
      agentId,
      txHash: released.txHash ?? null,
      explorerUrl: released.explorerUrl ?? null,
    });
  }
}

async function activateReadyDependents(
  goalId: string,
  agentsById: Map<string, Agent>,
  escrowProvider: ReturnType<typeof getEscrowProvider>,
): Promise<void> {
  const tasks = await getWorkflowTasksByGoal(goalId);
  const doneIds = new Set(
    tasks.filter((task) => task.status === "paid" || task.status === "completed").map((task) => task.id),
  );
  const readyToStart = tasks.filter(
    (task) => task.status === "pending" && task.dependsOn.every((depId) => doneIds.has(depId)),
  );

  for (const task of readyToStart) {
    const now = new Date().toISOString();
    await updateTask(task.id, { status: "running", startedAt: now });
    await logActivityEvent({
      id: newId("evt"),
      type: "task_started",
      message: `${task.title} started`,
      createdAt: now,
      goalId,
      agentId: task.agentId,
    });

    if (!task.agentId) continue;
    const escrow = await escrowProvider.lock({
      taskId: task.id,
      agentId: task.agentId,
      amount: task.price,
      agentWalletAddress: agentsById.get(task.agentId)?.walletAddress,
    });
    await logActivityEvent({
      id: newId("evt"),
      type: "escrow_locked",
      message: `Escrow locked for ${task.title} (${escrow.id})`,
      createdAt: now,
      goalId,
      agentId: task.agentId,
      txHash: escrow.txHash ?? null,
      explorerUrl: escrow.explorerUrl ?? null,
    });
  }
}

async function maybeCompleteGoal(goalId: string): Promise<void> {
  const tasks = await getWorkflowTasksByGoal(goalId);
  const allDone =
    tasks.length > 0 &&
    tasks.every((task) => task.status === "paid" || task.status === "completed");
  if (!allDone) return;

  const goal = await getGoalById(goalId);
  if (!goal || goal.status === "completed") return;

  await markGoalCompleted(goalId);
  await logActivityEvent({
    id: newId("evt"),
    type: "goal_completed",
    message: `Goal completed: "${goal.title}"`,
    createdAt: new Date().toISOString(),
    goalId,
    agentId: null,
  });
}
