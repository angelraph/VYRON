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
