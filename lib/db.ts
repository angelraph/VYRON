import "server-only";
import { cache } from "react";
import type {
  ActivityEvent,
  ActivityEventType,
  Agent,
  AgentAvailability,
  EscrowTransaction,
  Goal,
  UserPreferences,
  WorkflowTask,
  WorkflowTaskStatus,
} from "@/lib/types";
import { mockStore } from "@/lib/mock-store";
import { MOCK_USER_PREFERENCES } from "@/lib/mock-data";
import { getEscrowProvider } from "@/lib/escrow";

/** Whether a live Postgres connection is configured. When false, every
 * function below serves the seeded mock data instead — same shape, same
 * call sites, zero branching in the pages that call them. */
export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  const globalForPrisma = globalThis as unknown as {
    prisma?: InstanceType<typeof PrismaClient>;
  };
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Cached per-request via React's `cache()` — the agent roster is read
 * repeatedly across a single render (stats, goal cards, execution engine)
 * and never mutated mid-request, so dedupe is free and safe. */
export const getAgents = cache(async (): Promise<Agent[]> => {
  if (!isDatabaseConfigured) return mockStore.agents;
  const prisma = await getPrisma();
  const agents = await prisma.agent.findMany({ orderBy: { rating: "desc" } });
  return agents.map((agent) => ({
    ...agent,
    joinedAt: agent.joinedAt.toISOString(),
  }));
});

export async function getAgentById(id: string): Promise<Agent | null> {
  if (!isDatabaseConfigured) {
    return mockStore.agents.find((agent) => agent.id === id) ?? null;
  }
  const prisma = await getPrisma();
  const agent = await prisma.agent.findUnique({ where: { id } });
  return agent ? { ...agent, joinedAt: agent.joinedAt.toISOString() } : null;
}

export async function setAgentAvailability(
  agentId: string,
  availability: AgentAvailability,
): Promise<Agent | null> {
  if (!isDatabaseConfigured) {
    const agent = mockStore.agents.find((entry) => entry.id === agentId);
    if (!agent) return null;
    agent.availability = availability;
    return agent;
  }
  const prisma = await getPrisma();
  const updated = await prisma.agent.update({
    where: { id: agentId },
    data: { availability },
  });
  return { ...updated, joinedAt: updated.joinedAt.toISOString() };
}

export async function getGoals(userId: string): Promise<Goal[]> {
  if (!isDatabaseConfigured) {
    return mockStore.goals.filter((goal) => goal.userId === userId);
  }
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

export async function getGoalById(id: string): Promise<Goal | null> {
  if (!isDatabaseConfigured) {
    return mockStore.goals.find((goal) => goal.id === id) ?? null;
  }
  const prisma = await getPrisma();
  const goal = await prisma.goal.findUnique({ where: { id } });
  return goal ? { ...goal, createdAt: goal.createdAt.toISOString() } : null;
}

function serializeTask(task: {
  startedAt: Date | null;
  reviewStartedAt: Date | null;
  [key: string]: unknown;
}): WorkflowTask {
  return {
    ...task,
    startedAt: task.startedAt ? task.startedAt.toISOString() : null,
    reviewStartedAt: task.reviewStartedAt
      ? task.reviewStartedAt.toISOString()
      : null,
  } as WorkflowTask;
}

export async function getWorkflowTasksByGoal(
  goalId: string,
): Promise<WorkflowTask[]> {
  if (!isDatabaseConfigured) {
    return mockStore.tasks
      .filter((task) => task.goalId === goalId)
      .sort((a, b) => a.order - b.order);
  }
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
  if (!isDatabaseConfigured) {
    return mockStore.tasks.filter(
      (task) =>
        task.agentId === agentId &&
        (task.status === "pending" || task.status === "running"),
    );
  }
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
  if (!isDatabaseConfigured) {
    return mockStore.tasks.filter(
      (task) => task.status === "running" || task.status === "review",
    );
  }
  const prisma = await getPrisma();
  const tasks = await prisma.workflowTask.findMany({
    where: { status: { in: ["running", "review"] } },
  });
  return tasks.map(serializeTask);
}

export async function getPendingTasksByGoal(
  goalId: string,
): Promise<WorkflowTask[]> {
  if (!isDatabaseConfigured) {
    return mockStore.tasks.filter(
      (task) => task.goalId === goalId && task.status === "pending",
    );
  }
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
  if (!isDatabaseConfigured) {
    const goalIds = new Set(
      mockStore.goals
        .filter((goal) => goal.userId === userId)
        .map((goal) => goal.id),
    );
    return [...mockStore.activity]
      .filter((event) => !event.goalId || goalIds.has(event.goalId))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);
  }
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
  if (!isDatabaseConfigured) {
    mockStore.activity.push(event);
    return;
  }
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
  if (!isDatabaseConfigured) {
    const taskIds = new Set(tasks.map((task) => task.id));
    return mockStore.escrow.filter((tx) => taskIds.has(tx.taskId));
  }
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
  if (!isDatabaseConfigured) {
    return mockStore.tasks.find((task) => task.id === taskId) ?? null;
  }
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
  if (!isDatabaseConfigured) {
    const task = mockStore.tasks.find((entry) => entry.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    Object.assign(task, patch);
    return task;
  }
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

export async function getLockedEscrowForTask(
  taskId: string,
): Promise<EscrowTransaction | null> {
  if (!isDatabaseConfigured) {
    return (
      mockStore.escrow.find(
        (tx) => tx.taskId === taskId && tx.status === "locked",
      ) ?? null
    );
  }
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
  if (!isDatabaseConfigured) {
    const goal = mockStore.goals.find((entry) => entry.id === goalId);
    if (goal) goal.status = "completed";
    return;
  }
  const prisma = await getPrisma();
  await prisma.goal.update({
    where: { id: goalId },
    data: { status: "completed" },
  });
}

// ---------------------------------------------------------------------------
// Persistent memory: user preferences + agent affinity
// ---------------------------------------------------------------------------

/** Cached per-request — read at goal-submission time, at settings render,
 * and by the monitor's self-healing path; never mutated mid-request. */
export const getUserPreferences = cache(
  async (userId: string): Promise<UserPreferences> => {
    if (!isDatabaseConfigured) {
      return (
        mockStore.preferences.get(userId) ?? {
          ...MOCK_USER_PREFERENCES,
          userId,
        }
      );
    }
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return {
      userId,
      budget: user?.budget ?? null,
      timezone: user?.timezone ?? null,
      preferredStack: user?.preferredStack ?? null,
      favoriteAgentIds: user?.favoriteAgentIds ?? [],
      walletAddress: user?.walletAddress ?? null,
    };
  },
);

export async function updateUserPreferences(
  userId: string,
  patch: Partial<Omit<UserPreferences, "userId">>,
): Promise<UserPreferences> {
  if (!isDatabaseConfigured) {
    const current = mockStore.preferences.get(userId) ?? {
      ...MOCK_USER_PREFERENCES,
      userId,
    };
    const updated = { ...current, ...patch, userId };
    mockStore.preferences.set(userId, updated);
    return updated;
  }
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
    favoriteAgentIds: updated.favoriteAgentIds,
    walletAddress: updated.walletAddress,
  };
}

/** How many times this user's goals have already used this agent — a
 * lightweight memory signal that nudges future matching. */
export async function getAgentAffinity(
  userId: string,
  agentId: string,
): Promise<number> {
  if (!isDatabaseConfigured) {
    return mockStore.affinity.get(`${userId}:${agentId}`) ?? 0;
  }
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
    if (!isDatabaseConfigured) {
      const prefix = `${userId}:`;
      const map = new Map<string, number>();
      for (const [key, count] of mockStore.affinity.entries()) {
        if (key.startsWith(prefix)) map.set(key.slice(prefix.length), count);
      }
      return map;
    }
    const prisma = await getPrisma();
    const records = await prisma.agentAffinity.findMany({ where: { userId } });
    return new Map(records.map((record) => [record.agentId, record.count]));
  },
);

async function incrementAgentAffinity(
  userId: string,
  agentId: string,
): Promise<void> {
  if (!isDatabaseConfigured) {
    const key = `${userId}:${agentId}`;
    mockStore.affinity.set(key, (mockStore.affinity.get(key) ?? 0) + 1);
    return;
  }
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

export interface PlannedTaskInput {
  title: string;
  description: string;
  specialization: string;
  order: number;
  dependsOnIndexes: number[];
  agentId: string | null;
  price: number;
  etaHours: number;
  trustScore: number | null;
  matchRationale: string | null;
}

export interface CreateGoalInput {
  userId: string;
  title: string;
  budget: number;
  tasks: PlannedTaskInput[];
}

/** Orchestrates the Execution Engine's output into persisted records: the
 * goal, its dependency-ordered tasks (kickoff tasks start "running" with
 * escrow locked through the active EscrowProvider, the rest wait "pending"),
 * and the activity events that narrate it. Mock mode writes to the
 * in-memory store; real mode uses a Prisma transaction — same shape either
 * way. Also records agent affinity so future matches for this user can
 * factor in what's already worked. */
export async function createGoalWithWorkflow(
  input: CreateGoalInput,
): Promise<Goal> {
  const taskIds = input.tasks.map(() => newId("task"));
  const now = new Date().toISOString();
  const escrowProvider = getEscrowProvider();

  const goal: Goal = {
    id: newId("goal"),
    userId: input.userId,
    title: input.title,
    status: "in_progress",
    budget: input.budget,
    createdAt: now,
  };

  const tasks: WorkflowTask[] = input.tasks.map((task, i) => {
    const status = (task.dependsOnIndexes.length === 0
      ? "running"
      : "pending") satisfies WorkflowTaskStatus;
    return {
      id: taskIds[i],
      goalId: goal.id,
      title: task.title,
      description: task.description,
      order: task.order,
      dependsOn: task.dependsOnIndexes.map((depIndex) => taskIds[depIndex]),
      status,
      specialization: task.specialization,
      agentId: task.agentId,
      price: task.price,
      etaHours: task.etaHours,
      trustScore: task.trustScore,
      matchRationale: task.matchRationale,
      startedAt: status === "running" ? now : null,
      reviewStartedAt: null,
    };
  });

  if (!isDatabaseConfigured) {
    mockStore.goals.unshift(goal);
    mockStore.tasks.push(...tasks);
  } else {
    const prisma = await getPrisma();
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
      ...tasks.map((task) =>
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
  }

  await logActivityEvent({
    id: newId("evt"),
    type: "goal_created" as ActivityEventType,
    message: `Goal created: "${goal.title}"`,
    createdAt: now,
    goalId: goal.id,
    agentId: null,
  });

  const agentsById = new Map((await getAgents()).map((agent) => [agent.id, agent]));

  for (const task of tasks) {
    if (!task.agentId) continue;

    await logActivityEvent({
      id: newId("evt"),
      type: "agent_matched",
      message: `Agent matched to ${task.title}`,
      createdAt: now,
      goalId: goal.id,
      agentId: task.agentId,
    });
    await incrementAgentAffinity(input.userId, task.agentId);

    if (task.status !== "running") continue;

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
      goalId: goal.id,
      agentId: task.agentId,
      txHash: escrow.txHash ?? null,
      explorerUrl: escrow.explorerUrl ?? null,
    });
    await logActivityEvent({
      id: newId("evt"),
      type: "task_started",
      message: `${task.title} started`,
      createdAt: now,
      goalId: goal.id,
      agentId: task.agentId,
    });
  }

  return goal;
}

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

  let task: WorkflowTask | undefined;
  let previousAgentId: string | null = null;

  if (!isDatabaseConfigured) {
    task = mockStore.tasks.find((entry) => entry.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    previousAgentId = task.agentId;

    const openEscrow = mockStore.escrow.find(
      (tx) => tx.taskId === taskId && tx.status === "locked",
    );
    if (openEscrow) {
      const refunded = await escrowProvider.refund(openEscrow.id);
      await logActivityEvent({
        id: newId("evt"),
        type: "escrow_refunded",
        message: `Escrow refunded for ${task.title} — ${reason}`,
        createdAt: now,
        goalId,
        agentId: previousAgentId,
        txHash: refunded.txHash ?? null,
        explorerUrl: refunded.explorerUrl ?? null,
      });
    }

    task.agentId = newAgentId;
    task.trustScore = trustScore;
    task.matchRationale = rationale;
  } else {
    const prisma = await getPrisma();
    const existing = await prisma.workflowTask.findUniqueOrThrow({
      where: { id: taskId },
    });
    previousAgentId = existing.agentId;

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
    task = serializeTask(updated);
  }

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
