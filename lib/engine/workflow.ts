import "server-only";
import type { WorkflowTaskStatus } from "@/lib/types";
import type {
  AgentAssignment,
  ExecutionPlan,
  ExecutionTask,
  ExecutionWorkflow,
} from "@/lib/engine/types";

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Builds the real dependency graph for a goal from its plan and real agent
 * assignments — pure, no persistence (see `memory.ts#saveExecution` for
 * that). Kickoff tasks (no dependencies) start "running" immediately;
 * everything else waits "pending" until `advanceWorkflow` unblocks it. */
export function createWorkflow(
  goalId: string,
  plan: ExecutionPlan,
  assignments: AgentAssignment[],
): ExecutionWorkflow {
  const taskIds = plan.tasks.map(() => newId("task"));
  const now = new Date().toISOString();
  const assignmentByIndex = new Map(assignments.map((assignment) => [assignment.taskIndex, assignment]));

  const tasks: ExecutionTask[] = plan.tasks.map((task, i) => {
    const assignment = assignmentByIndex.get(i);
    const dependsOn = task.dependsOnIndexes.map((depIndex) => taskIds[depIndex]);
    const status: WorkflowTaskStatus = dependsOn.length === 0 ? "running" : "pending";

    return {
      id: taskIds[i],
      goalId,
      title: task.title,
      description: task.description,
      order: i,
      dependsOn,
      status,
      specialization: task.specialization,
      agentId: assignment?.agent?.id ?? null,
      price: assignment?.agent?.pricePerTask ?? 0,
      etaHours: task.estimatedHours,
      trustScore: assignment?.agent ? assignment.trustScore : null,
      matchRationale: assignment?.agent ? assignment.rationale : null,
      startedAt: status === "running" ? now : null,
      reviewStartedAt: null,
    };
  });

  return { goalId, tasks };
}

export interface AdvanceResult {
  workflow: ExecutionWorkflow;
  justStarted: ExecutionTask[];
}

/** Recomputes which pending tasks are now unblocked (every dependency
 * paid/completed) — a pure function over the current task list. The
 * caller persists the resulting status changes and locks escrow for
 * newly-started tasks (via `memory.ts#saveWorkflow`); this never writes
 * anything itself. */
export function advanceWorkflow(workflow: ExecutionWorkflow): AdvanceResult {
  const doneIds = new Set(
    workflow.tasks
      .filter((task) => task.status === "paid" || task.status === "completed")
      .map((task) => task.id),
  );
  const justStarted: ExecutionTask[] = [];
  const now = new Date().toISOString();

  const tasks = workflow.tasks.map((task) => {
    if (task.status === "pending" && task.dependsOn.every((depId) => doneIds.has(depId))) {
      const started: ExecutionTask = { ...task, status: "running", startedAt: now };
      justStarted.push(started);
      return started;
    }
    return task;
  });

  return { workflow: { goalId: workflow.goalId, tasks }, justStarted };
}

/** True once every task in the workflow has reached a terminal state. */
export function isWorkflowComplete(workflow: ExecutionWorkflow): boolean {
  return (
    workflow.tasks.length > 0 &&
    workflow.tasks.every((task) => task.status === "paid" || task.status === "completed")
  );
}
