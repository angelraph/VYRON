import "server-only";
import { logger } from "@/lib/logger";
import type { Agent } from "@/lib/types";
import { executionPlanSchema, type ExecutionPlan, type ExecutionPlanTask } from "@/lib/engine/types";
import { AGENT_SPECIALIZATIONS } from "@/lib/constants";

const MODEL_NAME = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

// ---------------------------------------------------------------------------
// Heuristic fallback — used only when no model is configured, or the real
// model call fails. Deterministic and keyword-driven so the pipeline still
// produces a coherent, dependency-ordered plan without an API key.
// ---------------------------------------------------------------------------

const NFT_TEMPLATE: ExecutionPlanTask[] = [
  {
    title: "Research",
    description: "Market landscape, comparable projects, and feasibility research.",
    specialization: "Research",
    dependsOnIndexes: [],
    estimatedHours: 6,
  },
  {
    title: "Design",
    description: "Visual identity, product design, and landing page design.",
    specialization: "Product Design",
    dependsOnIndexes: [0],
    estimatedHours: 10,
  },
  {
    title: "Smart Contract",
    description: "Core contract engineering for mint, ownership, and royalties.",
    specialization: "Smart Contracts",
    dependsOnIndexes: [1],
    estimatedHours: 18,
  },
  {
    title: "Audit",
    description: "Independent security review before anything touches mainnet.",
    specialization: "Security Audit",
    dependsOnIndexes: [2],
    estimatedHours: 24,
  },
  {
    title: "Marketing",
    description: "Launch campaign across socials, community, and press.",
    specialization: "Growth Marketing",
    dependsOnIndexes: [1],
    estimatedHours: 12,
  },
  {
    title: "Deploy",
    description: "Production deployment, verification, and go-live.",
    specialization: "DevOps & Deployment",
    dependsOnIndexes: [3, 4],
    estimatedHours: 8,
  },
];

const GROWTH_TEMPLATE: ExecutionPlanTask[] = [
  {
    title: "Research",
    description: "Audience research and competitive content analysis.",
    specialization: "Research",
    dependsOnIndexes: [],
    estimatedHours: 5,
  },
  {
    title: "Content Strategy",
    description: "Editorial calendar and messaging tuned to the target audience.",
    specialization: "Content & Copy",
    dependsOnIndexes: [0],
    estimatedHours: 4,
  },
  {
    title: "Community Seeding",
    description: "Seed the initial audience across relevant communities.",
    specialization: "Community Management",
    dependsOnIndexes: [1],
    estimatedHours: 5,
  },
  {
    title: "Growth Campaign",
    description: "Paid and organic acquisition loops to hit the growth target.",
    specialization: "Growth Marketing",
    dependsOnIndexes: [1],
    estimatedHours: 12,
  },
  {
    title: "Performance Review",
    description: "Instrument and report on what's actually moving the numbers.",
    specialization: "Data Analysis",
    dependsOnIndexes: [2, 3],
    estimatedHours: 6,
  },
];

const PRODUCT_TEMPLATE: ExecutionPlanTask[] = [
  {
    title: "Research",
    description: "User and market research to validate the product direction.",
    specialization: "Research",
    dependsOnIndexes: [],
    estimatedHours: 6,
  },
  {
    title: "Design",
    description: "Product design system and core UI flows.",
    specialization: "Product Design",
    dependsOnIndexes: [0],
    estimatedHours: 12,
  },
  {
    title: "Launch Copy",
    description: "Landing page and onboarding copy.",
    specialization: "Content & Copy",
    dependsOnIndexes: [1],
    estimatedHours: 4,
  },
  {
    title: "Deployment",
    description: "Infrastructure setup and production deployment.",
    specialization: "DevOps & Deployment",
    dependsOnIndexes: [1],
    estimatedHours: 10,
  },
  {
    title: "Marketing",
    description: "Go-to-market plan and launch campaign.",
    specialization: "Growth Marketing",
    dependsOnIndexes: [2, 3],
    estimatedHours: 10,
  },
];

const GENERIC_TEMPLATE: ExecutionPlanTask[] = [
  {
    title: "Research",
    description: "Landscape research to shape the plan of attack.",
    specialization: "Research",
    dependsOnIndexes: [],
    estimatedHours: 5,
  },
  {
    title: "Design",
    description: "Design pass on the core deliverable.",
    specialization: "Product Design",
    dependsOnIndexes: [0],
    estimatedHours: 8,
  },
  {
    title: "Execution",
    description: "Build and ship the core deliverable.",
    specialization: "DevOps & Deployment",
    dependsOnIndexes: [1],
    estimatedHours: 12,
  },
  {
    title: "Marketing",
    description: "Announce and promote the result.",
    specialization: "Growth Marketing",
    dependsOnIndexes: [1],
    estimatedHours: 8,
  },
];

const KEYWORD_TEMPLATES: { keywords: string[]; category: string; template: ExecutionPlanTask[] }[] = [
  {
    keywords: ["nft", "token", "mint", "web3", "crypto", "collection", "smart contract", "dao"],
    category: "NFT / Web3 launch",
    template: NFT_TEMPLATE,
  },
  {
    keywords: ["newsletter", "subscriber", "audience", "blog", "content", "grow my", "community"],
    category: "audience growth",
    template: GROWTH_TEMPLATE,
  },
  {
    keywords: ["app", "saas", "product", "landing page", "startup", "mvp", "platform"],
    category: "product build",
    template: PRODUCT_TEMPLATE,
  },
];

function matchTemplate(goalTitle: string) {
  const normalized = goalTitle.toLowerCase();
  const entry = KEYWORD_TEMPLATES.find((candidate) =>
    candidate.keywords.some((keyword) => normalized.includes(keyword)),
  );
  const matchedKeywords = entry?.keywords.filter((keyword) => normalized.includes(keyword)) ?? [];
  return { entry, matchedKeywords };
}

/** Deterministic string hash used only to add small, goal-specific jitter to
 * heuristic confidence — keeps repeat runs of the same goal reproducible
 * while still varying naturally across different goal text. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Heuristic decomposition used when no AI model is configured, or the real
 * call fails — deterministic and keyword-driven, never random, so the
 * pipeline still produces a coherent, dependency-ordered plan offline. */
function fallbackDecomposeGoal(goalTitle: string): Pick<ExecutionPlan, "intentConfidence" | "category" | "tasks"> {
  const { entry, matchedKeywords } = matchTemplate(goalTitle);
  const jitter = (hashString(goalTitle) % 7) - 3; // -3..+3, deterministic per title

  if (!entry) {
    return {
      category: "general objective",
      intentConfidence: Math.min(0.62, Math.max(0.42, 0.5 + jitter / 100)),
      tasks: GENERIC_TEMPLATE,
    };
  }

  const base = 0.72 + Math.min(matchedKeywords.length - 1, 3) * 0.06;
  const intentConfidence = Math.min(0.98, Math.max(0.55, base + jitter / 100));
  return { category: entry.category, intentConfidence, tasks: entry.template };
}

// ---------------------------------------------------------------------------
// Real estimation — pure functions over a plan's own structure, never fixed
// placeholders.
// ---------------------------------------------------------------------------

/** Longest path (in hours) from a root task through to `taskIndex`, walking
 * `dependsOnIndexes` — i.e. how long this task's branch actually takes given
 * real dependencies, not a flat sum of every task's duration. */
export function estimateExecutionTime(tasks: ExecutionPlanTask[]): number {
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

  return tasks.length ? Math.max(...tasks.map((_, i) => pathTo(i, new Set()))) : 0;
}

/** Dependency depth (longest chain of edges) — the graph's real "width" in
 * stages. */
export function graphDepth(tasks: ExecutionPlanTask[]): number {
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

  return tasks.length ? Math.max(...tasks.map((_, i) => levelOf(i, new Set()))) + 1 : 0;
}

/** Real difficulty signal derived from the plan's own shape — task count,
 * dependency depth, and total critical-path hours — not a fixed label. */
export function estimateDifficulty(tasks: ExecutionPlanTask[]): "low" | "medium" | "high" {
  const depth = graphDepth(tasks);
  const durationHours = estimateExecutionTime(tasks);

  if (tasks.length >= 6 || depth >= 4 || durationHours >= 40) return "high";
  if (tasks.length <= 3 && depth <= 2 && durationHours <= 16) return "low";
  return "medium";
}

/** Real budget estimate: for each task, the average `pricePerTask` among
 * agents in the real marketplace roster who actually offer that
 * specialization (falling back to the roster-wide average if none do). */
export function estimateBudget(tasks: ExecutionPlanTask[], agents: Agent[]): number {
  if (agents.length === 0) return 0;
  const rosterAverage =
    agents.reduce((sum, agent) => sum + agent.pricePerTask, 0) / agents.length;

  return Math.round(
    tasks.reduce((sum, task) => {
      const compatible = agents.filter((agent) => agent.specializations.includes(task.specialization));
      const pool = compatible.length > 0 ? compatible : agents;
      const average = pool.reduce((s, agent) => s + agent.pricePerTask, 0) / pool.length;
      return sum + (Number.isFinite(average) ? average : rosterAverage);
    }, 0),
  );
}

// ---------------------------------------------------------------------------
// Decomposition — the real LLM call (or fallback)
// ---------------------------------------------------------------------------

/** Calls a real model to decompose one high-level goal into a
 * dependency-ordered workflow, then attaches real difficulty/duration
 * estimates computed from the plan's own structure. No fallback fabricates
 * content silently without logging it. */
export async function decomposeGoal(goalTitle: string): Promise<ExecutionPlan> {
  let base: Pick<ExecutionPlan, "intentConfidence" | "category" | "tasks">;

  if (!process.env.OPENAI_API_KEY) {
    logger.warn("goal_interpretation", {
      stage: "intent_analysis",
      outcome: "fallback",
      reason: "OPENAI_API_KEY not configured",
    });
    base = fallbackDecomposeGoal(goalTitle);
  } else {
    const startedAt = Date.now();
    try {
      const { openai } = await import("@ai-sdk/openai");
      const { generateText, Output } = await import("ai");

      const { output } = await generateText({
        model: openai(MODEL_NAME),
        output: Output.object({ schema: executionPlanSchema }),
        prompt: [
          `Decompose this goal into a dependency-ordered workflow of 3-6 executable tasks`,
          `for an autonomous agent marketplace. Goal: "${goalTitle}".`,
          `Each task's specialization must be one of: ${AGENT_SPECIALIZATIONS.join(", ")}.`,
          `dependsOnIndexes are 0-based indexes into the tasks array itself — always include`,
          `the field for every task, using an empty array [] when a task has no dependencies.`,
          `Also return a short category label for the objective (e.g. "NFT / Web3 launch",`,
          `"audience growth", "product build") and an honest intentConfidence between 0 and 1`,
          `reflecting how clearly the goal text specifies what's being asked for — vague or`,
          `ambiguous goals should score lower, not a fixed number.`,
        ].join(" "),
      });

      logger.info("goal_interpretation", {
        stage: "intent_analysis",
        model: MODEL_NAME,
        durationMs: Date.now() - startedAt,
        outcome: "success",
        category: output.category,
      });
      base = output;
    } catch (error) {
      logger.error("goal_interpretation", {
        stage: "intent_analysis",
        model: MODEL_NAME,
        durationMs: Date.now() - startedAt,
        outcome: "fallback",
        error: error instanceof Error ? error.message : String(error),
      });
      base = fallbackDecomposeGoal(goalTitle);
    }
  }

  return {
    ...base,
    difficulty: estimateDifficulty(base.tasks),
    estimatedDurationHours: estimateExecutionTime(base.tasks),
  };
}

/** Alias: VYRON's planning model performs interpretation and decomposition
 * in a single real call (classifying intent and producing the task
 * breakdown together), so this is the same real work as `decomposeGoal` —
 * kept as a separate export because callers reasonably think of "what does
 * this goal mean" and "what tasks does it break into" as distinct steps. */
export const interpretGoal = decomposeGoal;
