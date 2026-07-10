import "server-only";
import * as memory from "@/lib/engine/memory";
import { createWorkflow } from "@/lib/engine/workflow";
import type { Goal } from "@/lib/types";
import type {
  AgentAssignment,
  ExecutionPlan,
  ExecutionRecord,
  ExecutionWorkflow,
} from "@/lib/engine/types";

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export interface CreateGoalParams {
  userId: string;
  title: string;
  budget: number;
  plan: ExecutionPlan;
  assignments: AgentAssignment[];
}

/** The central Goal lifecycle: turns a real plan + real agent assignments
 * into a persisted Goal and its dependency-ordered workflow. Builds the DAG
 * (`workflow.ts#createWorkflow`), then persists goal + tasks + kickoff
 * escrow locks in one real transaction (`memory.ts#saveExecution`) — the
 * engine's single entry point for bringing a new goal into existence. */
export async function createGoal(
  params: CreateGoalParams,
): Promise<{ goal: Goal; workflow: ExecutionWorkflow }> {
  const goalId = newId("goal");
  const workflow = createWorkflow(goalId, params.plan, params.assignments);
  const goal = await memory.saveExecution(
    { id: goalId, userId: params.userId, title: params.title, budget: params.budget },
    workflow,
  );
  return { goal, workflow };
}

/** The goal + its current tasks — the real, persisted execution state. */
export async function getGoalRecord(goalId: string): Promise<ExecutionRecord | null> {
  return memory.loadExecution(goalId);
}

export async function completeGoal(goalId: string): Promise<void> {
  await memory.markGoalDone(goalId);
}
