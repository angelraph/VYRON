import "server-only";
import { matchAgentForTask } from "@/lib/engine/matcher";
import {
  getActiveTasksForAgent,
  getAgentAffinityMap,
  getAgentById,
  getAgents,
  getGoalById,
  getUserPreferences,
  reassignTask,
  setAgentAvailability,
} from "@/lib/db";

export interface ReplanOutcome {
  taskId: string;
  taskTitle: string;
  goalId: string;
  previousAgentId: string | null;
  newAgentId: string | null;
  newAgentName: string | null;
  trustScore: number | null;
  rationale: string | null;
}

/** Called when an agent becomes unavailable mid-flight. Finds every task of
 * theirs that hasn't finished yet, re-runs real matching (excluding the now
 * -unavailable agent) against the live marketplace and each task owner's
 * memory, and reassigns — refunding and re-locking escrow as needed. This is
 * the engine reacting to real state, not a scripted transition. */
export async function replanForUnavailableAgent(
  agentId: string,
): Promise<ReplanOutcome[]> {
  const unavailableAgent = await getAgentById(agentId);
  await setAgentAvailability(agentId, "offline");

  const affectedTasks = await getActiveTasksForAgent(agentId);
  const agents = (await getAgents()).filter((agent) => agent.id !== agentId);

  const outcomes: ReplanOutcome[] = [];

  for (const task of affectedTasks) {
    const goal = await getGoalById(task.goalId);
    if (!goal) continue;

    const [preferences, affinity] = await Promise.all([
      getUserPreferences(goal.userId),
      getAgentAffinityMap(goal.userId),
    ]);

    const match = matchAgentForTask(agents, task.specialization, undefined, {
      favoriteAgentIds: preferences.favoriteAgentIds,
      affinity,
    });

    if (!match.agent) {
      outcomes.push({
        taskId: task.id,
        taskTitle: task.title,
        goalId: task.goalId,
        previousAgentId: agentId,
        newAgentId: null,
        newAgentName: null,
        trustScore: null,
        rationale: null,
      });
      continue;
    }

    const reason = `${unavailableAgent?.name ?? "the previous agent"} became unavailable`;
    const { previousAgentId } = await reassignTask({
      taskId: task.id,
      goalId: task.goalId,
      newAgentId: match.agent.id,
      trustScore: match.trustScore,
      rationale: match.rationale,
      reason,
    });

    outcomes.push({
      taskId: task.id,
      taskTitle: task.title,
      goalId: task.goalId,
      previousAgentId,
      newAgentId: match.agent.id,
      newAgentName: match.agent.name,
      trustScore: match.trustScore,
      rationale: match.rationale,
    });
  }

  return outcomes;
}
