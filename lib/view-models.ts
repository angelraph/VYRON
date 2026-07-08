import type { Agent, Goal, WorkflowTask } from "@/lib/types";

export interface TaskRow {
  task: WorkflowTask;
  goal: Goal;
  agent: Agent | null;
}

export function buildTaskRows(
  goals: Goal[],
  tasksByGoal: WorkflowTask[][],
  agents: Agent[],
): TaskRow[] {
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  return goals.flatMap((goal, i) =>
    tasksByGoal[i].map((task) => ({
      task,
      goal,
      agent: task.agentId ? (agentsById.get(task.agentId) ?? null) : null,
    })),
  );
}
