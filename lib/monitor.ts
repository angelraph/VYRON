import "server-only";
import { matchAgentForTask } from "@/lib/ai/agent-matcher";
import { getEscrowProvider } from "@/lib/escrow";
import {
  getActiveTasks,
  getAgentAffinityMap,
  getAgents,
  getGoalById,
  getLockedEscrowForTask,
  getUserPreferences,
  getWorkflowTasksByGoal,
  logActivityEvent,
  markGoalCompleted,
  reassignTask,
  updateTask,
} from "@/lib/db";
import {
  AUTO_APPROVE_TRUST_THRESHOLD,
  REVIEW_WINDOW_SIMULATED_HOURS,
  STALL_DETECTION_MULTIPLIER,
  simulatedHoursElapsedSince,
} from "@/lib/simulation-clock";
import type { Agent, WorkflowTask } from "@/lib/types";

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** How much slower than quoted an agent actually tends to run, given real
 * attributes computed at match time — not a coin flip. A busy or
 * lower-rated agent genuinely takes longer; this is what the stall
 * detector below measures against. */
function computeDeliveryDelayFactor(agent: Agent | undefined): number {
  if (!agent) return 1;
  let factor = 1;
  if (agent.rating < 4.8) factor += (4.8 - agent.rating) * 0.6;
  if (agent.availability === "busy") factor += 0.25;
  if (agent.availability === "offline") factor += 1;
  return Math.min(factor, 2.2);
}

/** One tick of the autonomous monitor: the piece of VYRON that keeps
 * working without anyone clicking anything. Walks every task that's
 * actually in flight (running or in review) across every goal, and — using
 * only real elapsed simulated time and the trust score computed at
 * assignment — decides on its own whether a task has been delivered,
 * whether it's stalled and needs a new agent, whether to auto-approve it
 * or hold it for longer scrutiny, whether to release escrow, whether a
 * dependent task can now start, and whether the whole goal is done. */
export async function runMonitorTick(): Promise<void> {
  const activeTasks = await getActiveTasks();
  if (activeTasks.length === 0) return;

  const agents = await getAgents();
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const escrowProvider = getEscrowProvider();
  const touchedGoalIds = new Set<string>();

  for (const task of activeTasks) {
    const agent = task.agentId ? agentsById.get(task.agentId) : undefined;

    if (task.status === "running" && task.startedAt) {
      const elapsed = simulatedHoursElapsedSince(task.startedAt);
      const delayFactor = computeDeliveryDelayFactor(agent);
      const effectiveEta = task.etaHours * delayFactor;

      if (elapsed >= effectiveEta) {
        const now = new Date().toISOString();
        await updateTask(task.id, { status: "review", reviewStartedAt: now });
        await logActivityEvent({
          id: newId("evt"),
          type: "task_delivered",
          message: `${agent?.name ?? "Agent"} delivered ${task.title}`,
          createdAt: now,
          goalId: task.goalId,
          agentId: task.agentId,
        });
        touchedGoalIds.add(task.goalId);
        continue;
      }

      const stallThreshold = task.etaHours * STALL_DETECTION_MULTIPLIER;
      if (delayFactor > STALL_DETECTION_MULTIPLIER && elapsed >= stallThreshold) {
        await selfHealStalledTask(task, agent, agents);
        touchedGoalIds.add(task.goalId);
      }
      continue;
    }

    if (task.status === "review" && task.reviewStartedAt) {
      const reviewElapsed = simulatedHoursElapsedSince(task.reviewStartedAt);
      const trustOk =
        task.trustScore === null || task.trustScore >= AUTO_APPROVE_TRUST_THRESHOLD;
      // Lower-trust assignments get a longer autonomous scrutiny window —
      // a real behavioral consequence of the trust score, not a fixed wait.
      const requiredWindow = trustOk
        ? REVIEW_WINDOW_SIMULATED_HOURS
        : REVIEW_WINDOW_SIMULATED_HOURS * 2;
      if (reviewElapsed < requiredWindow) continue;

      await settleTask(task.id, task.goalId, task.title, task.price, task.agentId, agent, trustOk, task.trustScore, escrowProvider);
      touchedGoalIds.add(task.goalId);
    }
  }

  for (const goalId of touchedGoalIds) {
    await activateReadyDependents(goalId, agentsById, escrowProvider);
    await maybeCompleteGoal(goalId);
  }
}

/** Detected mid-flight, not on a click: the assigned agent is running
 * meaningfully slower than committed and still hasn't delivered. Re-runs
 * real matching (excluding the underperforming agent, honoring the goal
 * owner's memory) and reassigns — same mechanics as manually forcing an
 * agent offline, just triggered by the monitor's own observation. */
async function selfHealStalledTask(
  task: WorkflowTask,
  stalledAgent: Agent | undefined,
  agents: Agent[],
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
    reason: `${stalledAgent?.name ?? "the assigned agent"} fell behind schedule — VYRON reassigned it autonomously`,
  });
}

async function settleTask(
  taskId: string,
  goalId: string,
  taskTitle: string,
  price: number,
  agentId: string | null,
  agent: Agent | undefined,
  trustOk: boolean,
  trustScore: number | null,
  escrowProvider: ReturnType<typeof getEscrowProvider>,
): Promise<void> {
  const now = new Date().toISOString();
  await updateTask(taskId, { status: "paid" });

  await logActivityEvent({
    id: newId("evt"),
    type: "task_verified",
    message: trustOk
      ? `Verified ${taskTitle} — trust score ${trustScore ?? "n/a"}/100, auto-approved`
      : `Verified ${taskTitle} after extended review — trust score ${trustScore ?? "n/a"}/100`,
    createdAt: now,
    goalId,
    agentId,
  });

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
