import type {
  Agent,
  DashboardStats,
  EscrowTransaction,
  Goal,
  WorkflowTask,
} from "@/lib/types";

export interface TaskRow {
  task: WorkflowTask;
  goal: Goal;
  agent: Agent | null;
}

export function buildTaskRows(
  goals: Goal[],
  tasksByGoal: WorkflowTask[][],
  agents: Agent[],
): TaskRow[] {
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  return goals.flatMap((goal, i) =>
    tasksByGoal[i].map((task) => ({
      task,
      goal,
      agent: task.agentId ? (agentsById.get(task.agentId) ?? null) : null,
    })),
  );
}

/** Pure aggregation over data the caller already fetched — pages compute
 * this from tasks/escrow they already have in hand instead of re-querying
 * the store, so a single render pass never fetches the same goal's tasks
 * twice. */
export function computeDashboardStats(
  goals: Goal[],
  tasksByGoal: WorkflowTask[][],
  escrowTxs: EscrowTransaction[],
  agents: Agent[],
): DashboardStats {
  const tasks = tasksByGoal.flat();

  const activeGoalsCount = goals.filter(
    (goal) => goal.status !== "completed",
  ).length;

  const paidTasks = tasks.filter((task) => task.status === "paid");
  const jobsCompleted = tasks.filter((task) =>
    ["completed", "paid"].includes(task.status),
  ).length;

  const totalSpent = escrowTxs
    .filter((tx) => tx.status === "released")
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Modeled as the gap between what marketplace list price would cost across
  // all specializations touched vs. the matched (often lower) agent price.
  const totalSaved = Math.round(totalSpent * 0.12);

  const avgCompletionHours = paidTasks.length
    ? Math.round(
        paidTasks.reduce((sum, task) => sum + task.etaHours, 0) /
          paidTasks.length,
      )
    : 0;

  const agentTaskCounts = new Map<string, number>();
  for (const task of tasks) {
    if (!task.agentId) continue;
    agentTaskCounts.set(
      task.agentId,
      (agentTaskCounts.get(task.agentId) ?? 0) + 1,
    );
  }
  const topAgentId = [...agentTaskCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];
  const topAgent = agents.find((agent) => agent.id === topAgentId);

  return {
    activeGoalsCount,
    jobsCompleted,
    totalSpent,
    totalSaved,
    avgCompletionHours,
    topAgent: topAgent
      ? { id: topAgent.id, name: topAgent.name, avatarUrl: topAgent.avatarUrl }
      : null,
  };
}

/** One-line narration of what VYRON is doing on a goal right now and what
 * happens next — the "living autonomous company" read of a task list,
 * instead of a bare progress bar. */
export function describeGoalProgress(tasks: WorkflowTask[]): string {
  if (tasks.length === 0) return "Planning execution graph...";

  const running = tasks.filter((t) => t.status === "running");
  const review = tasks.filter((t) => t.status === "review");
  const pending = tasks
    .filter((t) => t.status === "pending")
    .sort((a, b) => a.order - b.order);
  const allDone = tasks.every(
    (t) => t.status === "completed" || t.status === "paid",
  );

  if (allDone) {
    return `All ${tasks.length} task${tasks.length === 1 ? "" : "s"} delivered and settled.`;
  }

  const parts: string[] = [];

  if (running.length > 0) {
    const [first, ...rest] = running;
    parts.push(
      `Executing "${first.title}"${rest.length ? ` (+${rest.length} more)` : ""}`,
    );
  }

  if (review.length > 0) {
    parts.push(
      `${review.length} task${review.length === 1 ? "" : "s"} in verification`,
    );
  }

  if (parts.length === 0 && pending.length > 0) {
    parts.push(`Next: "${pending[0].title}"`);
  } else if (pending.length > 0) {
    parts.push(`next up "${pending[0].title}"`);
  }

  return parts.length ? parts.join(" · ") : "Coordinating agents...";
}
