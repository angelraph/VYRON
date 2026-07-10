import "server-only";
import { z } from "zod";
import { AGENT_SPECIALIZATIONS } from "@/lib/constants";
import type { Agent, Goal, GoalStatus, WorkflowTask } from "@/lib/types";

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

export const executionPlanTaskSchema = z.object({
  title: z.string().min(2).max(80),
  description: z.string().min(10).max(300),
  specialization: z.enum(AGENT_SPECIALIZATIONS),
  dependsOnIndexes: z.array(z.number().int().min(0)),
  estimatedHours: z.number().min(1).max(80),
});

export const executionPlanSchema = z.object({
  /** 0-1 confidence that the objective was correctly understood — a real
   * model (or heuristic) signal, not a fixed placeholder. */
  intentConfidence: z.number().min(0).max(1),
  category: z.string().min(2).max(60),
  tasks: z.array(executionPlanTaskSchema).min(2).max(8),
});

export type ExecutionPlanTask = z.infer<typeof executionPlanTaskSchema>;

/** What `planner.ts` produces from a raw goal string. `difficulty` and
 * `estimatedDurationHours` are computed from the plan's own real structure
 * (task count, dependency depth, hours) by `estimateDifficulty`/
 * `estimateExecutionTime` — never fixed placeholders. */
export interface ExecutionPlan {
  intentConfidence: number;
  category: string;
  tasks: ExecutionPlanTask[];
  difficulty: "low" | "medium" | "high";
  estimatedDurationHours: number;
}

// ---------------------------------------------------------------------------
// Executor — real deliverable generation + verification
// ---------------------------------------------------------------------------

export const taskDeliverableSchema = z.object({
  /** One sentence describing what was actually produced — shown inline in
   * the activity feed ahead of the full deliverable text. */
  summary: z.string().min(10).max(200),
  /** The real work product for this task (the actual research findings,
   * design brief, copy, plan, etc.) — not a description of intended work. */
  deliverable: z.string().min(50).max(2000),
});

export type TaskDeliverable = z.infer<typeof taskDeliverableSchema>;

export const taskVerificationSchema = z.object({
  approved: z.boolean(),
  /** 0-100 — the reviewer's honest judgment of the deliverable's quality. */
  qualityScore: z.number().min(0).max(100),
  /** Plain-language reason for the verdict, referencing the actual content. */
  feedback: z.string().min(5).max(300),
});

export type TaskVerification = z.infer<typeof taskVerificationSchema>;

// ---------------------------------------------------------------------------
// Matcher
// ---------------------------------------------------------------------------

/** One real marketplace agent matched to one planned task's index. */
export interface AgentAssignment {
  taskIndex: number;
  agent: Agent | null;
  trustScore: number;
  candidateCount: number;
  rationale: string;
}

export interface MatchMemory {
  favoriteAgentIds?: string[];
  affinity?: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Workflow — the DAG `workflow.ts`/`executor.ts` operate on. Deliberately
// reuses the real, already-persisted `WorkflowTask` shape rather than
// inventing a parallel in-memory type with renamed fields.
// ---------------------------------------------------------------------------

export type ExecutionTask = WorkflowTask;

export interface ExecutionWorkflow {
  goalId: string;
  tasks: ExecutionTask[];
}

// ---------------------------------------------------------------------------
// Executor — structured, strongly-typed events the `ExecutionEngine`
// (an EventEmitter) emits. Distinct from `VeeEvent` in
// `lib/execution-engine.ts`, which narrates goal *creation* for the SSE
// stream the UI reads; these describe the ongoing autonomous execution
// lifecycle after a goal already exists.
// ---------------------------------------------------------------------------

export type ExecutionEventType =
  | "task_execution_started"
  | "task_execution_completed"
  | "task_execution_failed"
  | "task_verification_completed"
  | "task_reassigned"
  | "task_disputed"
  | "workflow_advanced"
  | "goal_completed";

export interface ExecutionEvent {
  type: ExecutionEventType;
  goalId: string;
  taskId?: string;
  agentId?: string | null;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Goal
// ---------------------------------------------------------------------------

export type { Goal, GoalStatus as GoalState };

/** Goal + its workflow tasks — the combined shape `memory.ts#loadExecution`
 * returns and `goal.ts` operates on. */
export interface ExecutionRecord {
  goal: Goal;
  tasks: ExecutionTask[];
}
