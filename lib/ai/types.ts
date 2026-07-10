import { z } from "zod";
import { AGENT_SPECIALIZATIONS } from "@/lib/constants";

export const goalPlanTaskSchema = z.object({
  title: z.string().min(2).max(80),
  description: z.string().min(10).max(300),
  specialization: z.enum(AGENT_SPECIALIZATIONS),
  dependsOnIndexes: z.array(z.number().int().min(0)),
  estimatedHours: z.number().min(1).max(80),
});

export const goalPlanSchema = z.object({
  /** 0-1 confidence that the objective was correctly understood — a real
   * model (or heuristic) signal, not a fixed placeholder. */
  intentConfidence: z.number().min(0).max(1),
  category: z.string().min(2).max(60),
  tasks: z.array(goalPlanTaskSchema).min(2).max(8),
});

export type GoalPlanTask = z.infer<typeof goalPlanTaskSchema>;
export type GoalPlan = z.infer<typeof goalPlanSchema>;

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
