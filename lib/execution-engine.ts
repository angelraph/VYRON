import "server-only";
import { decomposeGoal, graphDepth } from "@/lib/engine/planner";
import { matchAgentForTask } from "@/lib/engine/matcher";
import { createGoal } from "@/lib/engine/goal";
import type { AgentAssignment } from "@/lib/engine/types";
import { getAgentAffinityMap, getAgents, getUserPreferences } from "@/lib/db";
import type { Agent, Goal } from "@/lib/types";

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

/** One real marketplace agent and the real tasks it was actually assigned
 * for this goal — built from the same matching pass that decided
 * assignment, not recomputed or guessed at render time. */
export interface VeeAgentAssignment {
  agent: Agent;
  tasks: { title: string; description: string; specialization: string }[];
}

export interface VeeEvent {
  stage: VeeStage;
  message: string;
  done?: boolean;
  goal?: Goal;
  /** Set only on the final event — the real per-agent task breakdown for
   * the goal that was just created. */
  agentAssignments?: VeeAgentAssignment[];
  /** Set on stages with a genuinely countable sub-step (currently just the
   * per-task agent assignment loop) — a real fraction, not a fake percent. */
  progress?: { current: number; total: number };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs one goal through the VEE pipeline, yielding a real event per stage
 * as it actually completes. Every number and name in these messages comes
 * from genuine computation against the marketplace and the planned
 * workflow (via `lib/engine/planner` and `lib/engine/matcher`) — nothing
 * here is scripted copy, and delay between stages scales with how much
 * real work that stage actually did. The goal itself is persisted through
 * `lib/engine/goal`, the engine's single entry point for bringing a goal
 * into existence. This function's own job is purely to narrate that real
 * work to the SSE stream the UI reads — it holds no execution logic of
 * its own anymore. */
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

  const plan = await decomposeGoal(title);
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

  yield {
    stage: "dependency_graph",
    message: `Generated execution graph — ${plan.tasks.length} nodes, ${dependencyEdges} dependencies, depth ${depth}. Estimated duration ≈ ${plan.estimatedDurationHours}h critical path.`,
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
    progress: { current: 0, total: matches.length },
  };
  await sleep(300 + matches.length * 70);

  for (const [i, { task, match }] of matches.entries()) {
    yield {
      stage: "agent_assignment",
      message: match.agent
        ? `${match.agent.name} assigned to ${task.title} — trust score ${match.trustScore}/100 across ${match.candidateCount} candidate(s), ${match.rationale}`
        : `No compatible agent found for ${task.title} among ${match.candidateCount} candidate(s)`,
      progress: { current: i + 1, total: matches.length },
    };
    await sleep(220 + match.candidateCount * 15);
  }

  const assignments: AgentAssignment[] = matches.map(({ match }, taskIndex) => ({
    taskIndex,
    agent: match.agent,
    trustScore: match.trustScore,
    candidateCount: match.candidateCount,
    rationale: match.rationale,
  }));
  const totalBudget = budget ?? estimatedCost;

  const { goal } = await createGoal({
    userId,
    title,
    budget: totalBudget,
    plan,
    assignments,
  });

  const agentAssignments: VeeAgentAssignment[] = [];
  const assignmentByAgentId = new Map<string, VeeAgentAssignment>();
  for (const { task, match } of matches) {
    if (!match.agent) continue;
    let entry = assignmentByAgentId.get(match.agent.id);
    if (!entry) {
      entry = { agent: match.agent, tasks: [] };
      assignmentByAgentId.set(match.agent.id, entry);
      agentAssignments.push(entry);
    }
    entry.tasks.push({
      title: task.title,
      description: task.description,
      specialization: task.specialization,
    });
  }

  yield {
    stage: "execution_monitoring",
    message: `Escrow initialized. Execution started — ${kickoffTasks} task(s) running now, ~${plan.estimatedDurationHours}h to completion.`,
    done: true,
    goal,
    agentAssignments,
  };
}
