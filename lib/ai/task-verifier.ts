import "server-only";
import { taskVerificationSchema, type TaskVerification } from "@/lib/ai/types";
import type { WorkflowTask } from "@/lib/types";

export interface VerificationContext {
  goalTitle: string;
  task: WorkflowTask;
  deliverable: string;
}

/** Independent quality pass over a real deliverable — the only thing that
 * gates escrow release. No fallback: if this throws, the caller leaves the
 * task in review rather than approving on a failed check. */
export async function verifyTask(ctx: VerificationContext): Promise<TaskVerification> {
  const { openai } = await import("@ai-sdk/openai");
  const { generateText, Output } = await import("ai");

  const { output } = await generateText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
    output: Output.object({ schema: taskVerificationSchema }),
    prompt: [
      `You are an independent quality reviewer for an autonomous agent marketplace.`,
      `Goal: "${ctx.goalTitle}".`,
      `Task: "${ctx.task.title}" — ${ctx.task.description}`,
      `The assigned agent produced this deliverable:`,
      `"""\n${ctx.deliverable}\n"""`,
      `Judge honestly whether this deliverable actually satisfies the task`,
      `description — completeness, relevance, and concrete usefulness, not`,
      `just length or confident tone. Return approved (true only if it`,
      `genuinely meets the task), a qualityScore 0-100, and brief feedback`,
      `explaining the score — specific enough to act on if it's rejected.`,
    ].join(" "),
  });

  return output;
}
