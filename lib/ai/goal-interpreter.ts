import "server-only";
import { AGENT_SPECIALIZATIONS } from "@/lib/constants";
import { goalPlanSchema, type GoalPlan } from "@/lib/ai/types";
import { mockInterpretGoal } from "@/lib/ai/mock-planner";
import { logger } from "@/lib/logger";

const MODEL_NAME = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

/** Decomposes one high-level goal into a dependency-ordered workflow. Uses a
 * live model via the Vercel AI SDK when configured; otherwise falls back to
 * a deterministic heuristic so the "no chatbot UI" execution experience
 * works fully offline. */
export async function interpretGoal(goalTitle: string): Promise<GoalPlan> {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn("goal_interpretation", {
      stage: "intent_analysis",
      outcome: "fallback",
      reason: "OPENAI_API_KEY not configured",
    });
    return mockInterpretGoal(goalTitle);
  }

  const startedAt = Date.now();
  try {
    const { openai } = await import("@ai-sdk/openai");
    const { generateText, Output } = await import("ai");

    const { output } = await generateText({
      model: openai(MODEL_NAME),
      output: Output.object({ schema: goalPlanSchema }),
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

    return output;
  } catch (error) {
    logger.error("goal_interpretation", {
      stage: "intent_analysis",
      model: MODEL_NAME,
      durationMs: Date.now() - startedAt,
      outcome: "fallback",
      error: error instanceof Error ? error.message : String(error),
    });
    return mockInterpretGoal(goalTitle);
  }
}
