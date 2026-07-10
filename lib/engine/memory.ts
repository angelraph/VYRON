import "server-only";
import {
  disputeEscrow as dbDisputeEscrow,
  getActiveTasks as dbGetActiveTasks,
  getAgentAffinityMap,
  getAgentById,
  getAgents,
  getDependencyDeliverables,
  getGoalById,
  getLatestDelivery,
  getLockedEscrowForTask,
  getPrisma,
  getUserPreferences,
  getWorkflowTasksByGoal,
  incrementAgentAffinity,
  logActivityEvent,
  markGoalCompleted,
  reassignTask as dbReassignTask,
  updateTask as dbUpdateTask,
  type ReassignmentResult,
} from "@/lib/db";
import { getEscrowProvider } from "@/lib/escrow";
import type {
  ActivityEventType,
  Agent,
  EscrowTransaction,
  Goal,
  UserPreferences,
  WorkflowTask,
} from "@/lib/types";
import type { ExecutionRecord, ExecutionWorkflow, MatchMemory } from "@/lib/engine/types";

/** `lib/engine`'s single interface for database access — every other
 * engine module (`planner`, `matcher`, `workflow`, `executor`, `goal`)
 * reads and writes through here, never through `@/lib/db` directly. Pages
 * and other app code keep using `@/lib/db` exactly as before; this is a
 * purpose-built facade for the engine, not a replacement for it — nothing
 * here duplicates a Prisma query that isn't a thin, real pass-through. */

// ---------------------------------------------------------------------------
// Execution (goal + workflow) persistence
// ---------------------------------------------------------------------------

/** Persists a brand-new goal and the already-built workflow
 * (`workflow.ts#createWorkflow` assigns every task's real id; this uses
 * those ids directly rather than generating its own — one id-generation
 * pass, not two). One real Prisma transaction for goal + tasks, then real
 * activity events, real kickoff escrow locks, and real affinity credit —
 * exactly what used to happen inline in the old goal-creation flow, moved
 * here as the engine's single write path for bringing a goal into
 * existence. */
export async function saveExecution(
  goalInput: { id: string; userId: string; title: string; budget: number },
  workflow: ExecutionWorkflow,
): Promise<Goal> {
  const prisma = await getPrisma();
  const now = new Date().toISOString();
  const goal: Goal = { ...goalInput, status: "in_progress", createdAt: now };

  await prisma.$transaction([
    prisma.goal.create({
      data: {
        id: goal.id,
        userId: goal.userId,
        title: goal.title,
        status: goal.status,
        budget: goal.budget,
      },
    }),
    ...workflow.tasks.map((task) =>
      prisma.workflowTask.create({
        data: {
          id: task.id,
          goalId: task.goalId,
          title: task.title,
          description: task.description,
          order: task.order,
          dependsOn: task.dependsOn,
          status: task.status,
          specialization: task.specialization,
          agentId: task.agentId,
          price: task.price,
          etaHours: task.etaHours,
          trustScore: task.trustScore,
          matchRationale: task.matchRationale,
          startedAt: task.startedAt ? new Date(task.startedAt) : null,
        },
      }),
    ),
  ]);

  await saveEvent({
    type: "goal_created",
    message: `Goal created: "${goal.title}"`,
    goalId: goal.id,
    agentId: null,
  });

  const agents = await getAgents();
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const escrowProvider = getEscrowProvider();

  for (const task of workflow.tasks) {
    if (!task.agentId) continue;

    await saveEvent({
      type: "agent_matched",
      message: `Agent matched to ${task.title}`,
      goalId: goal.id,
      agentId: task.agentId,
    });
    await incrementAgentAffinity(goal.userId, task.agentId);

    if (task.status !== "running") continue;

    const escrow = await escrowProvider.lock({
      taskId: task.id,
      agentId: task.agentId,
      amount: task.price,
      agentWalletAddress: agentsById.get(task.agentId)?.walletAddress,
    });
    await saveEvent({
      type: "escrow_locked",
      message: `Escrow locked for ${task.title} (${escrow.id})`,
      goalId: goal.id,
      agentId: task.agentId,
      txHash: escrow.txHash ?? null,
      explorerUrl: escrow.explorerUrl ?? null,
    });
    await saveEvent({
      type: "task_started",
      message: `${task.title} started`,
      goalId: goal.id,
      agentId: task.agentId,
    });
  }

  return goal;
}

/** Persists the effects of `workflow.ts#advanceWorkflow` — flips
 * newly-unblocked tasks to "running" and locks their real escrow. Real
 * Prisma writes and a real escrow lock per task, not an assumed state. */
export async function saveWorkflow(
  goalId: string,
  justStarted: WorkflowTask[],
): Promise<void> {
  const escrowProvider = getEscrowProvider();
  const agents = await getAgents();
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

  for (const task of justStarted) {
    const now = new Date().toISOString();
    await dbUpdateTask(task.id, { status: "running", startedAt: now });
    await saveEvent({
      type: "task_started",
      message: `${task.title} started`,
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
    await saveEvent({
      type: "escrow_locked",
      message: `Escrow locked for ${task.title} (${escrow.id})`,
      goalId,
      agentId: task.agentId,
      txHash: escrow.txHash ?? null,
      explorerUrl: escrow.explorerUrl ?? null,
    });
  }
}

/** The real activity log write — the engine's only path to it. */
export async function saveEvent(params: {
  type: ActivityEventType;
  message: string;
  goalId: string;
  agentId?: string | null;
  txHash?: string | null;
  explorerUrl?: string | null;
}): Promise<void> {
  await logActivityEvent({
    id: `evt-${crypto.randomUUID().slice(0, 8)}`,
    type: params.type,
    message: params.message,
    createdAt: new Date().toISOString(),
    goalId: params.goalId,
    agentId: params.agentId ?? null,
    txHash: params.txHash ?? null,
    explorerUrl: params.explorerUrl ?? null,
  });
}

/** A goal and its current tasks — the combined execution state `goal.ts`
 * and `executor.ts` work from. Null if the goal doesn't exist. */
export async function loadExecution(goalId: string): Promise<ExecutionRecord | null> {
  const goal = await getGoalById(goalId);
  if (!goal) return null;
  const tasks = await getWorkflowTasksByGoal(goalId);
  return { goal, tasks };
}

/** Patches a task's lifecycle fields — status/startedAt/reviewStartedAt. */
export async function updateExecution(
  taskId: string,
  patch: Partial<Pick<WorkflowTask, "status" | "startedAt" | "reviewStartedAt">>,
): Promise<WorkflowTask> {
  return dbUpdateTask(taskId, patch);
}

export async function markGoalDone(goalId: string): Promise<void> {
  await markGoalCompleted(goalId);
}

// ---------------------------------------------------------------------------
// Marketplace + memory signals (read-only from the engine's perspective)
// ---------------------------------------------------------------------------

export async function getAgentRoster(): Promise<Agent[]> {
  return getAgents();
}

export async function getAgent(agentId: string): Promise<Agent | null> {
  return getAgentById(agentId);
}

export async function getMatchMemory(userId: string): Promise<MatchMemory> {
  const [preferences, affinity] = await Promise.all([
    getUserPreferences(userId),
    getAgentAffinityMap(userId),
  ]);
  return { favoriteAgentIds: preferences.favoriteAgentIds, affinity };
}

export async function getPreferences(userId: string): Promise<UserPreferences> {
  return getUserPreferences(userId);
}

// ---------------------------------------------------------------------------
// Task execution support (dependency context, delivery history)
// ---------------------------------------------------------------------------

export async function getActiveTasks(): Promise<WorkflowTask[]> {
  return dbGetActiveTasks();
}

export async function getDependencyOutputs(
  task: WorkflowTask,
): Promise<{ taskTitle: string; deliverable: string }[]> {
  return getDependencyDeliverables(task);
}

export async function getDelivery(
  task: Pick<WorkflowTask, "id" | "goalId" | "title">,
): Promise<{ summary: string; deliverable: string } | null> {
  return getLatestDelivery(task);
}

// ---------------------------------------------------------------------------
// Escrow
// ---------------------------------------------------------------------------

export async function getLockedEscrow(taskId: string): Promise<EscrowTransaction | null> {
  return getLockedEscrowForTask(taskId);
}

export async function releaseEscrow(escrowId: string): Promise<EscrowTransaction> {
  return getEscrowProvider().release(escrowId);
}

/** Terminal failure state for escrow the executor has given up retrying —
 * an existing, previously-unused `EscrowStatus` value; no schema change. */
export async function disputeEscrow(escrowId: string): Promise<void> {
  await dbDisputeEscrow(escrowId);
}

// ---------------------------------------------------------------------------
// Reassignment
// ---------------------------------------------------------------------------

export async function reassign(params: {
  taskId: string;
  goalId: string;
  newAgentId: string;
  trustScore: number;
  rationale: string;
  reason: string;
}): Promise<ReassignmentResult> {
  return dbReassignTask(params);
}
