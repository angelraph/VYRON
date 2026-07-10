import "server-only";
import { taskDeliverableSchema, type TaskDeliverable } from "@/lib/ai/types";
import type { Agent, WorkflowTask } from "@/lib/types";

export interface DependencyOutput {
  taskTitle: string;
  deliverable: string;
}

export interface ExecutionContext {
  goalTitle: string;
  task: WorkflowTask;
  agent: Agent;
  /** Real outputs of this task's already-settled dependencies, so
   * downstream work genuinely builds on upstream content instead of being
   * generated in isolation. */
  dependencyOutputs: DependencyOutput[];
  /** Set when this is a regeneration after a rejected verification pass —
   * the reviewer's actual feedback, fed back in so the retry addresses it. */
  revisionFeedback?: string;
}

/** Calls a real model to produce this task's actual deliverable, in the
 * voice of the assigned marketplace agent. No fallback: if this throws, the
 * caller treats it as a genuine execution failure (retry / reassign), the
 * same way a real worker failing to deliver would be handled. */
export async function executeTask(ctx: ExecutionContext): Promise<TaskDeliverable> {
  const { openai } = await import("@ai-sdk/openai");
  const { generateText, Output } = await import("ai");

  const contextBlock = ctx.dependencyOutputs.length
    ? ctx.dependencyOutputs
        .map((dep) => `Output already delivered for "${dep.taskTitle}":\n${dep.deliverable}`)
        .join("\n\n")
    : "This is a kickoff task with no prior task outputs to build on.";

  const revisionBlock = ctx.revisionFeedback
    ? `A previous attempt at this task was sent back during review with this feedback: "${ctx.revisionFeedback}". Address it directly this time.`
    : "";

  const { output } = await generateText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
    output: Output.object({ schema: taskDeliverableSchema }),
    prompt: [
      `You are ${ctx.agent.name}, an AI agent in an autonomous work marketplace.`,
      `Your persona: ${ctx.agent.tagline} — ${ctx.agent.bio}`,
      `You were assigned this task as part of the goal: "${ctx.goalTitle}".`,
      `Task: "${ctx.task.title}" — ${ctx.task.description}`,
      `Specialization: ${ctx.task.specialization}.`,
      contextBlock,
      revisionBlock,
      `Produce the actual deliverable content for this task — the real work`,
      `product this task calls for (concrete research findings, a design`,
      `brief, real copy, a real plan — whatever fits), not a description of`,
      `what you intend to do. Return a one-sentence "summary" of what you`,
      `delivered and the full "deliverable" text (aim for 150-350 words).`,
    ]
      .filter(Boolean)
      .join(" "),
  });

  return output;
}
