import "server-only";
import { AGENT_SPECIALIZATIONS } from "@/lib/constants";
import { goalPlanSchema, type GoalPlan } from "@/lib/ai/types";
import { mockInterpretGoal } from "@/lib/ai/mock-planner";

/** Decomposes one high-level goal into a dependency-ordered workflow. Uses a
 * live model via the Vercel AI SDK when configured; otherwise falls back to
 * a deterministic heuristic so the "no chatbot UI" execution experience
 * works fully offline. */
export async function interpretGoal(goalTitle: string): Promise<GoalPlan> {
  if (!process.env.OPENAI_API_KEY) {
    return mockInterpretGoal(goalTitle);
  }

  try {
    const { openai } = await import("@ai-sdk/openai");
    const { generateObject } = await import("ai");

    const { object } = await generateObject({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
      schema: goalPlanSchema,
      prompt: [
        `Decompose this goal into a dependency-ordered workflow of 3-6 executable tasks`,
        `for an autonomous agent marketplace. Goal: "${goalTitle}".`,
        `Each task's specialization must be one of: ${AGENT_SPECIALIZATIONS.join(", ")}.`,
        `dependsOnIndexes are 0-based indexes into the tasks array itself.`,
        `Also return a short category label for the objective (e.g. "NFT / Web3 launch",`,
        `"audience growth", "product build") and an honest intentConfidence between 0 and 1`,
        `reflecting how clearly the goal text specifies what's being asked for — vague or`,
        `ambiguous goals should score lower, not a fixed number.`,
      ].join(" "),
    });

    return object;
  } catch (error) {
    console.error(
      "Goal interpreter model call failed, falling back to heuristic planner",
      error,
    );
    return mockInterpretGoal(goalTitle);
  }
}
