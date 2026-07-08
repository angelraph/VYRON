import type { Agent } from "@/lib/types";

export interface AgentMatchResult {
  agent: Agent | null;
  /** How many agents in the marketplace actually offer this specialization. */
  candidateCount: number;
  /** 0-100 — the winning agent's weighted score, scaled for display. */
  trustScore: number;
  /** Which signal(s) actually decided the pick, in plain language. */
  rationale: string;
}

export interface MatchMemory {
  /** Agent IDs the user has explicitly favorited. */
  favoriteAgentIds?: string[];
  /** Agent ID -> number of prior tasks this user has given them. */
  affinity?: Map<string, number>;
}

const SIGNAL_LABEL = {
  priceFit: "price fit",
  quality: "quality rating",
  experience: "track record",
  availability: "availability",
  memory: "past success with you",
} as const;

/** Ranks agents for a task by price fit, quality (rating), experience
 * (completed jobs), availability, and — when a user history is supplied —
 * accumulated memory (favorites and repeat-hire affinity), then reports
 * back exactly why the winner won. */
export function matchAgentForTask(
  agents: Agent[],
  specialization: string,
  budgetHint?: number,
  memory?: MatchMemory,
): AgentMatchResult {
  const candidates = agents.filter((agent) =>
    agent.specializations.includes(specialization),
  );
  const pool = candidates.length > 0 ? candidates : agents;
  if (pool.length === 0) {
    return { agent: null, candidateCount: 0, trustScore: 0, rationale: "No agents available." };
  }

  const scored = pool.map((agent) => {
    const priceFit = budgetHint
      ? Math.max(
          0,
          1 - Math.abs(agent.pricePerTask - budgetHint) / Math.max(budgetHint, agent.pricePerTask),
        )
      : 0.5;
    const quality = agent.rating / 5;
    const experience = Math.min(agent.completedJobs / 300, 1);
    const availability =
      agent.availability === "available"
        ? 1
        : agent.availability === "busy"
          ? 0.4
          : 0;

    const isFavorite = memory?.favoriteAgentIds?.includes(agent.id) ?? false;
    const hireCount = memory?.affinity?.get(agent.id) ?? 0;
    const memorySignal = Math.min(
      (isFavorite ? 0.5 : 0) + Math.min(hireCount * 0.15, 0.5),
      1,
    );

    const hasMemory = Boolean(memory);
    const weights = hasMemory
      ? { priceFit: 0.22, quality: 0.3, experience: 0.15, availability: 0.18, memory: 0.15 }
      : { priceFit: 0.25, quality: 0.35, experience: 0.2, availability: 0.2, memory: 0 };

    const weighted = {
      priceFit: priceFit * weights.priceFit,
      quality: quality * weights.quality,
      experience: experience * weights.experience,
      availability: availability * weights.availability,
      memory: memorySignal * weights.memory,
    };
    const score =
      weighted.priceFit + weighted.quality + weighted.experience + weighted.availability + weighted.memory;

    return { agent, score, weighted };
  });

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  const rankedSignals = (Object.entries(winner.weighted) as [keyof typeof SIGNAL_LABEL, number][])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  const rationale = rankedSignals.length >= 2
    ? `strong ${SIGNAL_LABEL[rankedSignals[0][0]]} and ${SIGNAL_LABEL[rankedSignals[1][0]]}`
    : `strong ${SIGNAL_LABEL[rankedSignals[0]?.[0] ?? "quality"]}`;

  return {
    agent: winner.agent,
    candidateCount: candidates.length > 0 ? candidates.length : pool.length,
    trustScore: Math.round(winner.score * 100),
    rationale,
  };
}
