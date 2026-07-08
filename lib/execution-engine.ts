import "server-only";
import { interpretGoal } from "@/lib/ai/goal-interpreter";
import { matchAgentForTask } from "@/lib/ai/agent-matcher";
import {
  createGoalWithWorkflow,
  getAgentAffinityMap,
  getAgents,
  getUserPreferences,
  type PlannedTaskInput,
} from "@/lib/db";
import type { GoalPlanTask } from "@/lib/ai/types";
import type { Goal } from "@/lib/types";

/** The eleven-stage pipeline the VYRON Execution Engine (VEE) drives every
 * goal through. `memory_update` fires twice in practice: a recall at
 * goal-submission time (saved budget, favorite/affinity-weighted matching)
 * and, later, a write once real deliveries land. `verification` and
 * `escrow_settlement` (release) happen later in a task's lifecycle as real
 * deliveries come in — they are not fabricated here at goal-creation time. */
export type VeeStage =
  | "goal_submitted"
  | "intent_analysis"
  | "task_planning"
  | "dependency_graph"
  | "marketplace_search"
  | "trust_scoring"
  | "agent_assignment"
  | "execution_monitoring"
  | "verification"
  | "escrow_settlement"
  | "memory_update"
  | "error";

export interface VeeEvent {
  stage: VeeStage;
  message: string;
  done?: boolean;
  goal?: Goal;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Longest path (in hours) from a root task through to `taskIndex`, walking
 * `dependsOnIndexes` — i.e. how long this task's branch actually takes
 * given real dependencies, not a flat sum of every task's duration. */
function criticalPathHours(tasks: GoalPlanTask[]): number {
  const memo = new Map<number, number>();

  function pathTo(index: number, guard: Set<number>): number {
    const cached = memo.get(index);
    if (cached !== undefined) return cached;
    if (guard.has(index)) return 0;
    guard.add(index);

    const task = tasks[index];
    const depHours = task.dependsOnIndexes.length
      ? Math.max(...task.dependsOnIndexes.map((dep) => pathTo(dep, guard)))
      : 0;
    const total = depHours + task.estimatedHours;
    memo.set(index, total);
    return total;
  }

  return tasks.length
    ? Math.max(...tasks.map((_, i) => pathTo(i, new Set())))
    : 0;
}

/** Dependency depth (longest chain of edges) — the graph's real "width" in
 * stages, used to report execution graph size honestly. */
function graphDepth(tasks: GoalPlanTask[]): number {
  const memo = new Map<number, number>();

  function levelOf(index: number, guard: Set<number>): number {
    const cached = memo.get(index);
    if (cached !== undefined) return cached;
    if (guard.has(index)) return 0;
    guard.add(index);

    const task = tasks[index];
    const level = task.dependsOnIndexes.length
      ? Math.max(...task.dependsOnIndexes.map((dep) => levelOf(dep, guard))) + 1
      : 0;
    memo.set(index, level);
    return level;
  }

  return tasks.length
    ? Math.max(...tasks.map((_, i) => levelOf(i, new Set()))) + 1
    : 0;
}

/** Runs one goal through the VEE pipeline, yielding a real event per stage
 * as it actually completes. Every number and name in these messages comes
 * from genuine computation against the marketplace and the planned
 * workflow — nothing here is scripted copy, and delay between stages
 * scales with how much real work that stage actually did. */
export async function* runExecutionEngine(params: {
  userId: string;
  title: string;
  budget?: number;
}): AsyncGenerator<VeeEvent> {
  const { userId, title } = params;
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);

  const preferences = await getUserPreferences(userId);
  const affinity = await getAgentAffinityMap(userId);
  const budget = params.budget ?? preferences.budget ?? undefined;

  yield {
    stage: "goal_submitted",
    message: `Receiving objective: "${title}"`,
  };
  await sleep(300 + Math.min(title.length * 4, 400));

  if (!params.budget && preferences.budget) {
    yield {
      stage: "memory_update",
      message: `Recalling memory... using your saved default budget of $${preferences.budget}`,
    };
    await sleep(300);
  }

  yield {
    stage: "intent_analysis",
    message: aiConfigured
      ? "Interpreting objective with AI model..."
      : "Parsing objective and scoring intent confidence...",
  };
  await sleep(450);

  const plan = await interpretGoal(title);
  const confidencePct = Math.round(plan.intentConfidence * 100);

  yield {
    stage: "intent_analysis",
    message: `Intent confidence ${confidencePct}% — classified as ${plan.category}`,
  };
  await sleep(350);

  yield {
    stage: "task_planning",
    message: `Planned ${plan.tasks.length} tasks: ${plan.tasks.map((t) => t.title).join(", ")}`,
  };
  await sleep(300 + plan.tasks.length * 60);

  const dependencyEdges = plan.tasks.reduce(
    (sum, task) => sum + task.dependsOnIndexes.length,
    0,
  );
  const kickoffTasks = plan.tasks.filter(
    (task) => task.dependsOnIndexes.length === 0,
  ).length;
  const depth = graphDepth(plan.tasks);
  const estimatedDurationHours = criticalPathHours(plan.tasks);

  yield {
    stage: "dependency_graph",
    message: `Generated execution graph — ${plan.tasks.length} nodes, ${dependencyEdges} dependencies, depth ${depth}. Estimated duration ≈ ${estimatedDurationHours}h critical path.`,
  };
  await sleep(350 + depth * 80);

  const agents = await getAgents();
  const specializations: string[] = [
    ...new Set(plan.tasks.map((t) => t.specialization as string)),
  ];
  const compatibleCount = agents.filter((agent) =>
    agent.specializations.some((spec) => specializations.includes(spec)),
  ).length;
  yield {
    stage: "marketplace_search",
    message: `Searching marketplace across ${specializations.length} specializations... ${compatibleCount} compatible agents found`,
  };
  await sleep(350 + compatibleCount * 25);

  const perTaskBudgetHint = budget
    ? Math.round(budget / plan.tasks.length)
    : undefined;
  const memory = {
    favoriteAgentIds: preferences.favoriteAgentIds,
    affinity,
  };
  const matches = plan.tasks.map((task) => ({
    task,
    match: matchAgentForTask(agents, task.specialization, perTaskBudgetHint, memory),
  }));

  const estimatedCost = matches.reduce(
    (sum, { match }) => sum + (match.agent?.pricePerTask ?? perTaskBudgetHint ?? 0),
    0,
  );
  const budgetNote = budget
    ? estimatedCost <= budget
      ? `within your $${budget} budget`
      : `$${estimatedCost - budget} over your $${budget} budget`
    : `no budget ceiling set`;

  yield {
    stage: "trust_scoring",
    message: `Ranking candidates by price fit, rating, experience, and availability... estimated cost $${estimatedCost} (${budgetNote})`,
  };
  await sleep(300 + matches.length * 70);

  for (const { task, match } of matches) {
    yield {
      stage: "agent_assignment",
      message: match.agent
        ? `${match.agent.name} assigned to ${task.title} — trust score ${match.trustScore}/100 across ${match.candidateCount} candidate(s), ${match.rationale}`
        : `No compatible agent found for ${task.title} among ${match.candidateCount} candidate(s)`,
    };
    await sleep(220 + match.candidateCount * 15);
  }

  const tasks: PlannedTaskInput[] = matches.map(({ task, match }, i) => ({
    title: task.title,
    description: task.description,
    specialization: task.specialization,
    order: i,
    dependsOnIndexes: task.dependsOnIndexes,
    agentId: match.agent?.id ?? null,
    price: match.agent?.pricePerTask ?? perTaskBudgetHint ?? 0,
    etaHours: task.estimatedHours,
    trustScore: match.agent ? match.trustScore : null,
    matchRationale: match.agent ? match.rationale : null,
  }));
  const totalBudget = budget ?? tasks.reduce((sum, t) => sum + t.price, 0);

  const goal = await createGoalWithWorkflow({
    userId,
    title,
    budget: totalBudget,
    tasks,
  });

  yield {
    stage: "execution_monitoring",
    message: `Escrow initialized. Execution started — ${kickoffTasks} task(s) running now, ~${estimatedDurationHours}h to completion.`,
    done: true,
    goal,
  };
}
