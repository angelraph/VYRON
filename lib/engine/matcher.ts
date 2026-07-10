import "server-only";
import type { Agent } from "@/lib/types";
import type { AgentAssignment, ExecutionPlanTask, MatchMemory } from "@/lib/engine/types";

const SIGNAL_LABEL = {
  priceFit: "price fit",
  quality: "quality rating",
  experience: "track record",
  availability: "availability",
  memory: "past success with you",
} as const;

export interface RankedAgent {
  agent: Agent;
  score: number;
  breakdown: {
    priceFit: number;
    quality: number;
    experience: number;
    availability: number;
    memory: number;
  };
}

/** Specialization score, step one: agents in the roster who actually offer
 * this task's specialization. Falls back to the full roster if nobody
 * matches exactly, so a task never goes unassigned just because the
 * taxonomy doesn't have a perfect fit. */
export function findCandidateAgents(agents: Agent[], specialization: string): Agent[] {
  const candidates = agents.filter((agent) => agent.specializations.includes(specialization));
  return candidates.length > 0 ? candidates : agents;
}

/** Ranks a candidate pool by price fit, quality (rating), experience
 * (completion rate proxy via completed jobs), availability (current
 * workload), and — when a user history is supplied — accumulated memory
 * (favorite boost, repeat-hire affinity). Returns every candidate
 * best-first, not just the winner, so callers needing runner-ups (e.g.
 * self-heal reassignment excluding the failed agent) don't have to
 * re-score from scratch. */
export function rankAgents(
  candidates: Agent[],
  budgetHint?: number,
  memory?: MatchMemory,
): RankedAgent[] {
  const scored = candidates.map((agent) => {
    const priceFit = budgetHint
      ? Math.max(
          0,
          1 - Math.abs(agent.pricePerTask - budgetHint) / Math.max(budgetHint, agent.pricePerTask),
        )
      : 0.5;
    const quality = agent.rating / 5;
    const experience = Math.min(agent.completedJobs / 300, 1);
    const availability =
      agent.availability === "available" ? 1 : agent.availability === "busy" ? 0.4 : 0;

    const isFavorite = memory?.favoriteAgentIds?.includes(agent.id) ?? false;
    const hireCount = memory?.affinity?.get(agent.id) ?? 0;
    const memorySignal = Math.min((isFavorite ? 0.5 : 0) + Math.min(hireCount * 0.15, 0.5), 1);

    const hasMemory = Boolean(memory);
    const weights = hasMemory
      ? { priceFit: 0.22, quality: 0.3, experience: 0.15, availability: 0.18, memory: 0.15 }
      : { priceFit: 0.25, quality: 0.35, experience: 0.2, availability: 0.2, memory: 0 };

    const breakdown = {
      priceFit: priceFit * weights.priceFit,
      quality: quality * weights.quality,
      experience: experience * weights.experience,
      availability: availability * weights.availability,
      memory: memorySignal * weights.memory,
    };
    const score =
      breakdown.priceFit + breakdown.quality + breakdown.experience + breakdown.availability + breakdown.memory;

    return { agent, score, breakdown };
  });

  return scored.sort((a, b) => b.score - a.score);
}

function describeRationale(breakdown: RankedAgent["breakdown"]): string {
  const rankedSignals = (Object.entries(breakdown) as [keyof typeof SIGNAL_LABEL, number][])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  return rankedSignals.length >= 2
    ? `strong ${SIGNAL_LABEL[rankedSignals[0][0]]} and ${SIGNAL_LABEL[rankedSignals[1][0]]}`
    : `strong ${SIGNAL_LABEL[rankedSignals[0]?.[0] ?? "quality"]}`;
}

export interface TaskMatchResult {
  agent: Agent | null;
  candidateCount: number;
  trustScore: number;
  rationale: string;
}

/** Matches one task to the best available agent: `findCandidateAgents` for
 * the specialization filter, `rankAgents` for the weighted score, then
 * reports back exactly why the winner won. */
export function matchAgentForTask(
  agents: Agent[],
  specialization: string,
  budgetHint?: number,
  memory?: MatchMemory,
): TaskMatchResult {
  const candidates = findCandidateAgents(agents, specialization);
  if (candidates.length === 0) {
    return { agent: null, candidateCount: 0, trustScore: 0, rationale: "No agents available." };
  }

  const ranked = rankAgents(candidates, budgetHint, memory);
  const winner = ranked[0];

  return {
    agent: winner.agent,
    candidateCount: candidates.length,
    trustScore: Math.round(winner.score * 100),
    rationale: describeRationale(winner.breakdown),
  };
}

/** Matches every task in a plan to a real agent in one pass — the batch
 * entry point `goal.ts` uses at creation time. `budgetHint` is per-task
 * since a plan's overall budget is typically divided across its tasks. */
export function assignTasks(
  tasks: ExecutionPlanTask[],
  agents: Agent[],
  budgetHint?: (taskIndex: number) => number | undefined,
  memory?: MatchMemory,
): AgentAssignment[] {
  return tasks.map((task, taskIndex) => {
    const match = matchAgentForTask(agents, task.specialization, budgetHint?.(taskIndex), memory);
    return {
      taskIndex,
      agent: match.agent,
      trustScore: match.trustScore,
      candidateCount: match.candidateCount,
      rationale: match.rationale,
    };
  });
}
