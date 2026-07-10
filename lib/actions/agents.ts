"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { replanForUnavailableAgent, type ReplanOutcome } from "@/lib/replanning";

const agentIdSchema = z.string().min(1).max(100);

/** Demo/admin control: flips an agent offline and lets the execution engine
 * adaptively replan every task that agent was actively holding. */
export async function simulateAgentUnavailableAction(
  agentId: string,
): Promise<ReplanOutcome[]> {
  const validAgentId = agentIdSchema.parse(agentId);
  const outcomes = await replanForUnavailableAgent(validAgentId);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workflows");
  revalidatePath("/dashboard/marketplace");
  revalidatePath("/dashboard/agents");
  revalidatePath("/dashboard/history");
  return outcomes;
}
