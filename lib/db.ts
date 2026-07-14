import "server-only";
import { cache } from "react";
import type { PrismaClient } from "@prisma/client";
import type {
  ActivityEvent,
  Agent,
  AgentAvailability,
  EscrowTransaction,
  Goal,
  UserPreferences,
  WorkflowTask,
} from "@/lib/types";
import { getEscrowProvider } from "@/lib/escrow";

/** Neon's serverless Postgres suspends the compute after a few minutes idle
 * — the first query after that hits a real (transient) connection error
 * while it wakes back up. Without a retry, that surfaces as a hard failure
 * on whatever page happened to run first (goal pages, dashboards, etc.),
 * which then "just works" on a manual refresh once Neon is warm. Retrying
 * the small set of Prisma's own transient-connection error codes here,
 * once, centrally, means every caller gets that resilience for free. */
const RETRIABLE_PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;

function extendWithRetry(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          let lastError: unknown;
          for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
            try {
              return await query(args);
            } catch (error) {
              lastError = error;
              // PrismaClientKnownRequestError (query-time) uses `.code`;
              // PrismaClientInitializationError (connection-time — what
              // Neon's cold-start actually throws) uses `.errorCode` and
              // also exposes its own `.retryable` flag.
              const errorInfo = error as { code?: string; errorCode?: string; retryable?: boolean } | null;
              const code = errorInfo?.code ?? errorInfo?.errorCode;
              const isRetriable = errorInfo?.retryable === true || (!!code && RETRIABLE_PRISMA_CODES.has(code));
              if (!isRetriable || attempt === RETRY_ATTEMPTS) {
                throw error;
              }
              await new Promise((resolve) => setTimeout(resolve, attempt * RETRY_BASE_DELAY_MS));
            }
          }
          throw lastError;
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof extendWithRetry>;

/** Exported so `/api/health` can run a real connectivity check against the
 * same singleton client the rest of the app uses, rather than spinning up
 * a second one. */
export async function getPrisma(): Promise<ExtendedPrismaClient> {
  const { PrismaClient: PrismaClientCtor } = await import("@prisma/client");
  const globalForPrisma = globalThis as unknown as {
    prisma?: ExtendedPrismaClient;
  };
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = extendWithRetry(new PrismaClientCtor());
  }
  return globalForPrisma.prisma;
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** `specializations`, `favoriteAgentIds`, and `dependsOn` are native
 * PostgreSQL array columns; this just narrows Prisma's return type to the
 * plain `string[]` shape the rest of the app expects. */
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

/** Cached per-request via React's `cache()` — the agent roster is read
 * repeatedly across a single render (stats, goal cards, execution engine)
 * and never mutated mid-request, so dedupe is free and safe. */
export const getAgents = cache(async (): Promise<Agent[]> => {
  const prisma = await getPrisma();
  const agents = await prisma.agent.findMany({ orderBy: { rating: "desc" } });
  return agents.map((agent) => ({
    ...agent,
    specializations: asStringArray(agent.specializations),
    joinedAt: agent.joinedAt.toISOString(),
  }));
});

export async function getAgentById(id: string): Promise<Agent | null> {
  const prisma = await getPrisma();
  const agent = await prisma.agent.findUnique({ where: { id } });
  return agent
    ? {
        ...agent,
        specializations: asStringArray(agent.specializations),
        joinedAt: agent.joinedAt.toISOString(),
      }
    : null;
}

export async function setAgentAvailability(
  agentId: string,
  availability: AgentAvailability,
): Promise<Agent | null> {
  const prisma = await getPrisma();
  const updated = await prisma.agent.update({
    where: { id: agentId },
    data: { availability },
  });
  return {
    ...updated,
    specializations: asStringArray(updated.specializations),
    joinedAt: updated.joinedAt.toISOString(),
  };
}

export async function getGoals(userId: string): Promise<Goal[]> {
  const prisma = await getPrisma();
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return goals.map((goal) => ({
    ...goal,
    createdAt: goal.createdAt.toISOString(),
  }));
}

/** Unscoped by design — only for internal system code (the autonomous
 * monitor, replanning) that legitimately operates across every user's
 * goals. Never call this with a user-supplied id on a request path; use
 * `getGoalForUser` there instead. */
export async function getGoalById(id: string): Promise<Goal | null> {
  const prisma = await getPrisma();
  const goal = await prisma.goal.findUnique({ where: { id } });
  return goal ? { ...goal, createdAt: goal.createdAt.toISOString() } : null;
}

/** The authorization-checked read for any request path that takes a goal
 * id from user input (route params, form data, etc.). Returns null both
 * when the goal doesn't exist and when it belongs to someone else —
 * deliberately indistinguishable, so this can't be used to enumerate
 * other users' goal ids. */
export async function getGoalForUser(id: string, userId: string): Promise<Goal | null> {
  const prisma = await getPrisma();
  const goal = await prisma.goal.findFirst({ where: { id, userId } });
  return goal ? { ...goal, createdAt: goal.createdAt.toISOString() } : null;
}

function serializeTask(task: {
  dependsOn: unknown;
  startedAt: Date | null;
  reviewStartedAt: Date | null;
  [key: string]: unknown;
}): WorkflowTask {
  return {
    ...task,
    dependsOn: asStringArray(task.dependsOn),
    startedAt: task.startedAt ? task.startedAt.toISOString() : null,
    reviewStartedAt: task.reviewStartedAt
      ? task.reviewStartedAt.toISOString()
      : null,
  } as WorkflowTask;
}

export async function getWorkflowTasksByGoal(
  goalId: string,
): Promise<WorkflowTask[]> {
  const prisma = await getPrisma();
  const tasks = await prisma.workflowTask.findMany({
    where: { goalId },
    orderBy: { order: "asc" },
  });
  return tasks.map(serializeTask);
}

/** Tasks currently assigned to an agent that haven't finished yet — the set
 * adaptive replanning needs to look at when that agent goes unavailable. */
export async function getActiveTasksForAgent(
  agentId: string,
): Promise<WorkflowTask[]> {
  const prisma = await getPrisma();
  const tasks = await prisma.workflowTask.findMany({
    where: { agentId, status: { in: ["pending", "running"] } },
  });
  return tasks.map(serializeTask);
}

/** All non-terminal tasks across every goal — what the autonomous monitor
 * scans each tick. Deliberately not scoped to one user; the monitor
 * watches the whole marketplace. */
export async function getActiveTasks(): Promise<WorkflowTask[]> {
  const prisma = await getPrisma();
  const tasks = await prisma.workflowTask.findMany({
    where: { status: { in: ["running", "review"] } },
  });
  return tasks.map(serializeTask);
}

/** Every not-yet-started task across every goal. Scanned each tick
 * alongside `getActiveTasks` so a goal whose running/review tasks just
 * finished (dropping its active-task count to zero) still gets checked for
 * newly-unblocked dependents — workflow advancement was previously only a
 * side effect of processing an active task, so a goal with pending tasks
 * but zero active ones could stall forever even after its dependencies
 * were satisfied. */
export async function getPendingTasks(): Promise<WorkflowTask[]> {
  const prisma = await getPrisma();
  const tasks = await prisma.workflowTask.findMany({
    where: { status: "pending" },
  });
  return tasks.map(serializeTask);
}

export async function getPendingTasksByGoal(
  goalId: string,
): Promise<WorkflowTask[]> {
  const prisma = await getPrisma();
  const tasks = await prisma.workflowTask.findMany({
    where: { goalId, status: "pending" },
  });
  return tasks.map(serializeTask);
}

export async function getActivityEvents(
  userId: string,
  limit = 20,
): Promise<ActivityEvent[]> {
  const prisma = await getPrisma();
  const events = await prisma.activityEvent.findMany({
    where: { goal: { userId } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return events.map((event) => ({
    ...event,
    createdAt: event.createdAt.toISOString(),
  }));
}

export async function logActivityEvent(event: ActivityEvent): Promise<void> {
  const prisma = await getPrisma();
  await prisma.activityEvent.create({
    data: {
      id: event.id,
      type: event.type,
      message: event.message,
      goalId: event.goalId,
      agentId: event.agentId,
    },
  });
}

/** Escrow rows for tasks the caller already fetched — lets pages that
 * already hold a goal's tasks (e.g. dashboard stats) pull escrow without
 * re-querying those same tasks a second time. */
export async function getEscrowTransactionsForTasks(
  tasks: WorkflowTask[],
): Promise<EscrowTransaction[]> {
  const prisma = await getPrisma();
  const txs = await prisma.escrowTransaction.findMany({
    where: { taskId: { in: tasks.map((task) => task.id) } },
  });
  return txs.map((tx) => ({
    ...tx,
    createdAt: tx.createdAt.toISOString(),
    releasedAt: tx.releasedAt ? tx.releasedAt.toISOString() : null,
  }));
}

export async function getEscrowTransactionsByGoal(
  goalId: string,
): Promise<EscrowTransaction[]> {
  const tasks = await getWorkflowTasksByGoal(goalId);
  return getEscrowTransactionsForTasks(tasks);
}

export async function getTaskById(taskId: string): Promise<WorkflowTask | null> {
  const prisma = await getPrisma();
  const task = await prisma.workflowTask.findUnique({ where: { id: taskId } });
  return task ? serializeTask(task) : null;
}

/** Patches a task's lifecycle fields — the autonomous monitor's only write
 * path onto WorkflowTask. */
export async function updateTask(
  taskId: string,
  patch: Partial<Pick<WorkflowTask, "status" | "startedAt" | "reviewStartedAt">>,
): Promise<WorkflowTask> {
  const prisma = await getPrisma();
  const updated = await prisma.workflowTask.update({
    where: { id: taskId },
    data: {
      status: patch.status,
      startedAt:
        patch.startedAt !== undefined
          ? patch.startedAt
            ? new Date(patch.startedAt)
            : null
          : undefined,
      reviewStartedAt:
        patch.reviewStartedAt !== undefined
          ? patch.reviewStartedAt
            ? new Date(patch.reviewStartedAt)
            : null
          : undefined,
    },
  });
  return serializeTask(updated);
}

/** A task claimed longer ago than this is assumed to belong to a
 * crashed/killed invocation, not one still legitimately mid-execution —
 * confirmed necessary live: killing a dev server mid-task once left a task
 * claimed forever with no process left to ever release it. Generous on
 * purpose: a single task's execute-or-verify pass can include a real LLM
 * call plus, now, up to WALLET_LOCK_ACQUIRE_TIMEOUT_MS of real chain writes
 * (escrow release, reputation record), so this must comfortably exceed the
 * worst realistic legitimate duration, not just the common case. */
const TASK_CLAIM_STALE_MS = 600_000;

/** Atomic cross-process mutex: succeeds if nobody currently holds the claim,
 * or if whoever did hasn't touched it in TASK_CLAIM_STALE_MS. Postgres
 * serializes concurrent UPDATEs on the same row, so of two overlapping
 * invocations racing this call, only one can ever see `count > 0` — the
 * other's WHERE no longer matches once the first commits. See the schema
 * comment on `WorkflowTask.claimedAt` for why this exists (Vercel
 * serverless has no shared in-memory state across invocations). */
export async function claimTask(taskId: string): Promise<boolean> {
  const prisma = await getPrisma();
  const staleBefore = new Date(Date.now() - TASK_CLAIM_STALE_MS);
  const result = await prisma.workflowTask.updateMany({
    where: { id: taskId, OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }] },
    data: { claimedAt: new Date() },
  });
  return result.count > 0;
}

/** Releases a claim taken by `claimTask`, regardless of how the caller's
 * processing ended (success, failure, or an early bail) — callers must run
 * this in a `finally` so a crash mid-processing can't leave a task
 * permanently unclaimable. */
export async function releaseTask(taskId: string): Promise<void> {
  const prisma = await getPrisma();
  await prisma.workflowTask.update({
    where: { id: taskId },
    data: { claimedAt: null },
  });
}

const WALLET_LOCK_ID = "orchestrator";
/** A held lock older than this is assumed to belong to a crashed/killed
 * invocation rather than one still legitimately mid-transaction -- without
 * this, one bad crash between acquire and release would permanently
 * deadlock every future escrow write. Kept comfortably above
 * WALLET_LOCK_ACQUIRE_TIMEOUT_MS: a waiter blocked for the full acquire
 * timeout must always time out on its own before this would consider
 * stealing whatever lock it's waiting on, or two callers could both believe
 * they hold it. */
const WALLET_LOCK_STALE_MS = 120_000;
/** Raised from an original 20s after live testing showed AgentRegistry +
 * Reputation writes (on top of escrow lock/release/refund) can queue 3-4
 * deep on the same wallet when multiple goals settle concurrently -- each
 * on-chain write (simulate + submit + wait for receipt) can itself take
 * 10-20s on X Layer Testnet, so a shallow timeout was firing under
 * perfectly normal concurrent load, not just genuine contention. */
const WALLET_LOCK_ACQUIRE_TIMEOUT_MS = 90_000;
const WALLET_LOCK_RETRY_DELAY_MS = 300;

/** Cross-process mutex for the orchestrator wallet's on-chain writes -- see
 * the schema comment on `WalletLock`. Unlike `claimTask` (where losing the
 * race just means "skip, someone else has it"), a wallet write genuinely
 * needs the lock to proceed, so this retries with jitter until it gets it
 * or times out, rather than failing immediately on the first contended
 * attempt. */
export async function acquireWalletLock(): Promise<void> {
  const prisma = await getPrisma();
  await prisma.walletLock.upsert({
    where: { id: WALLET_LOCK_ID },
    create: { id: WALLET_LOCK_ID },
    update: {},
  });

  const deadline = Date.now() + WALLET_LOCK_ACQUIRE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const staleBefore = new Date(Date.now() - WALLET_LOCK_STALE_MS);
    const result = await prisma.walletLock.updateMany({
      where: { id: WALLET_LOCK_ID, OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }] },
      data: { claimedAt: new Date() },
    });
    if (result.count > 0) return;
    await new Promise((resolve) =>
      setTimeout(resolve, WALLET_LOCK_RETRY_DELAY_MS + Math.random() * WALLET_LOCK_RETRY_DELAY_MS),
    );
  }
  throw new Error(
    "Could not acquire the orchestrator wallet lock in time -- too much concurrent escrow activity.",
  );
}

export async function releaseWalletLock(): Promise<void> {
  const prisma = await getPrisma();
  await prisma.walletLock.update({ where: { id: WALLET_LOCK_ID }, data: { claimedAt: null } });
}

export async function getLockedEscrowForTask(
  taskId: string,
): Promise<EscrowTransaction | null> {
  const prisma = await getPrisma();
  const tx = await prisma.escrowTransaction.findFirst({
    where: { taskId, status: "locked" },
  });
  return tx
    ? {
        ...tx,
        createdAt: tx.createdAt.toISOString(),
        releasedAt: tx.releasedAt ? tx.releasedAt.toISOString() : null,
      }
    : null;
}

export async function markGoalCompleted(goalId: string): Promise<void> {
  const prisma = await getPrisma();
  await prisma.goal.update({
    where: { id: goalId },
    data: { status: "completed" },
  });
}

/** Terminal failure state for escrow the monitor has given up retrying —
 * an existing, previously-unused `EscrowStatus` value, so this needs no
 * schema change. Surfaces stuck work for human review instead of silently
 * stalling forever or fabricating a settlement. */
export async function disputeEscrow(escrowId: string): Promise<void> {
  const prisma = await getPrisma();
  await prisma.escrowTransaction.update({
    where: { id: escrowId },
    data: { status: "disputed" },
  });
}

/** The most recent real deliverable recorded for a task, parsed back out of
 * the `ActivityEvent` log. There is no dedicated output column — the
 * `task_delivered` event's message IS the deliverable's storage, tagged
 * with the task's own title (matched via `contains`, not an exact id, so a
 * reassigned task's new delivery is still found regardless of which agent
 * produced it). Returns null if this task hasn't been executed yet. */
export async function getLatestDelivery(
  task: Pick<WorkflowTask, "id" | "goalId" | "title">,
): Promise<{ summary: string; deliverable: string } | null> {
  const { parseDeliveryMessage, deliveryMessageMatchesTask } = await import(
    "@/lib/engine/delivery-format"
  );
  const prisma = await getPrisma();
  const events = await prisma.activityEvent.findMany({
    where: { goalId: task.goalId, type: "task_delivered" },
    orderBy: { createdAt: "desc" },
  });
  const event = events.find((e) => deliveryMessageMatchesTask(e.message, task.title));
  return event ? parseDeliveryMessage(event.message, task.title) : null;
}

/** Real outputs already delivered for a task's dependencies — the context
 * the executor uses so downstream work genuinely builds on upstream
 * content instead of being generated in isolation. Dependencies with no
 * recorded delivery yet (shouldn't happen once dependency ordering is
 * respected) are simply omitted rather than blocking execution. */
export async function getDependencyDeliverables(
  task: WorkflowTask,
): Promise<{ taskTitle: string; deliverable: string }[]> {
  if (task.dependsOn.length === 0) return [];
  const prisma = await getPrisma();
  const depTasks = await prisma.workflowTask.findMany({
    where: { id: { in: task.dependsOn } },
  });
  const results: { taskTitle: string; deliverable: string }[] = [];
  for (const dep of depTasks) {
    const delivery = await getLatestDelivery({ id: dep.id, goalId: dep.goalId, title: dep.title });
    if (delivery) results.push({ taskTitle: dep.title, deliverable: delivery.deliverable });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Persistent memory: user preferences + agent affinity
// ---------------------------------------------------------------------------

/** Cached per-request — read at goal-submission time, at settings render,
 * and by the monitor's self-healing path; never mutated mid-request. */
export const getUserPreferences = cache(
  async (userId: string): Promise<UserPreferences> => {
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return {
      userId,
      budget: user?.budget ?? null,
      timezone: user?.timezone ?? null,
      preferredStack: user?.preferredStack ?? null,
      favoriteAgentIds: asStringArray(user?.favoriteAgentIds),
      walletAddress: user?.walletAddress ?? null,
    };
  },
);

export async function updateUserPreferences(
  userId: string,
  patch: Partial<Omit<UserPreferences, "userId">>,
): Promise<UserPreferences> {
  const prisma = await getPrisma();
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      budget: patch.budget,
      timezone: patch.timezone,
      preferredStack: patch.preferredStack,
      favoriteAgentIds: patch.favoriteAgentIds,
      walletAddress: patch.walletAddress,
    },
  });
  return {
    userId,
    budget: updated.budget,
    timezone: updated.timezone,
    preferredStack: updated.preferredStack,
    favoriteAgentIds: asStringArray(updated.favoriteAgentIds),
    walletAddress: updated.walletAddress,
  };
}

/** How many times this user's goals have already used this agent — a
 * lightweight memory signal that nudges future matching. */
export async function getAgentAffinity(
  userId: string,
  agentId: string,
): Promise<number> {
  const prisma = await getPrisma();
  const record = await prisma.agentAffinity.findUnique({
    where: { userId_agentId: { userId, agentId } },
  });
  return record?.count ?? 0;
}

/** Cached per-request. Read once per request ahead of any affinity
 * increments (goal creation, self-healing reassignment) — never re-read
 * after a write within the same request, so memoization can't go stale. */
export const getAgentAffinityMap = cache(
  async (userId: string): Promise<Map<string, number>> => {
    const prisma = await getPrisma();
    const records = await prisma.agentAffinity.findMany({ where: { userId } });
    return new Map(records.map((record) => [record.agentId, record.count]));
  },
);

/** Exported so `lib/engine/memory.ts` can record affinity from its own
 * (real, transactional) goal-creation write without duplicating this
 * upsert. */
export async function incrementAgentAffinity(
  userId: string,
  agentId: string,
): Promise<void> {
  const prisma = await getPrisma();
  await prisma.agentAffinity.upsert({
    where: { userId_agentId: { userId, agentId } },
    update: { count: { increment: 1 } },
    create: { userId, agentId, count: 1 },
  });
}

// ---------------------------------------------------------------------------
// Goal + workflow orchestration
// ---------------------------------------------------------------------------

export interface ReassignmentResult {
  task: WorkflowTask;
  previousAgentId: string | null;
}

/** Moves a task to a new agent — used by adaptive replanning when the
 * originally assigned agent goes unavailable. Refunds any escrow already
 * locked with the old agent and re-locks with the new one if the task was
 * already running. */
export async function reassignTask(params: {
  taskId: string;
  goalId: string;
  newAgentId: string;
  trustScore: number;
  rationale: string;
  reason: string;
}): Promise<ReassignmentResult> {
  const { taskId, goalId, newAgentId, trustScore, rationale, reason } = params;
  const now = new Date().toISOString();
  const escrowProvider = getEscrowProvider();

  const prisma = await getPrisma();
  const existing = await prisma.workflowTask.findUniqueOrThrow({
    where: { id: taskId },
  });
  const previousAgentId = existing.agentId;

  const openEscrow = await prisma.escrowTransaction.findFirst({
    where: { taskId, status: "locked" },
  });
  if (openEscrow) {
    const refunded = await escrowProvider.refund(openEscrow.id);
    await logActivityEvent({
      id: newId("evt"),
      type: "escrow_refunded",
      message: `Escrow refunded for ${existing.title} — ${reason}`,
      createdAt: now,
      goalId,
      agentId: previousAgentId,
      txHash: refunded.txHash ?? null,
      explorerUrl: refunded.explorerUrl ?? null,
    });
  }

  const updated = await prisma.workflowTask.update({
    where: { id: taskId },
    data: { agentId: newAgentId, trustScore, matchRationale: rationale },
  });
  const task = serializeTask(updated);

  await logActivityEvent({
    id: newId("evt"),
    type: "agent_reassigned",
    message: `${task.title} reassigned — ${reason}`,
    createdAt: now,
    goalId,
    agentId: newAgentId,
  });
  await incrementAgentAffinity(
    (await getGoalById(goalId))?.userId ?? "",
    newAgentId,
  );

  if (task.status === "running") {
    const newAgent = await getAgentById(newAgentId);
    const escrow = await escrowProvider.lock({
      taskId,
      agentId: newAgentId,
      amount: task.price,
      agentWalletAddress: newAgent?.walletAddress,
    });
    await logActivityEvent({
      id: newId("evt"),
      type: "escrow_locked",
      message: `Escrow re-locked for ${task.title} (${escrow.id})`,
      createdAt: now,
      goalId,
      agentId: newAgentId,
      txHash: escrow.txHash ?? null,
      explorerUrl: escrow.explorerUrl ?? null,
    });
  }

  return { task, previousAgentId };
}
