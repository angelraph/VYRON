"use server";

import { revalidatePath } from "next/cache";
import { replanForUnavailableAgent, type ReplanOutcome } from "@/lib/replanning";

/** Demo/admin control: flips an agent offline and lets the execution engine
 * adaptively replan every task that agent was actively holding. */
export async function simulateAgentUnavailableAction(
  agentId: string,
): Promise<ReplanOutcome[]> {
  const outcomes = await replanForUnavailableAgent(agentId);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workflows");
  revalidatePath("/dashboard/marketplace");
  revalidatePath("/dashboard/agents");
  revalidatePath("/dashboard/history");
  return outcomes;
}
