export type AgentAvailability = "available" | "busy" | "offline";

export interface Agent {
  id: string;
  name: string;
  avatarUrl: string | null;
  tagline: string;
  bio: string;
  specializations: string[];
  rating: number;
  completedJobs: number;
  pricePerTask: number;
  etaHours: number;
  availability: AgentAvailability;
  joinedAt: string;
  /** On-chain payout address, if this agent has been registered with a
   * real wallet. Required for the xlayer escrow provider to pay them —
   * absent, escrow fails loudly rather than sending real funds to an
   * address nobody controls. */
  walletAddress?: string | null;
}

export type GoalStatus = "planning" | "in_progress" | "completed";

export interface Goal {
  id: string;
  userId: string;
  title: string;
  status: GoalStatus;
  budget: number;
  createdAt: string;
}

export type WorkflowTaskStatus =
  | "pending"
  | "running"
  | "review"
  | "completed"
  | "paid";

export interface WorkflowTask {
  id: string;
  goalId: string;
  title: string;
  description: string;
  order: number;
  dependsOn: string[];
  status: WorkflowTaskStatus;
  /** The specialization this task needs matched — kept so a task can be
   * re-matched later (replanning) without re-deriving it from the agent. */
  specialization: string;
  agentId: string | null;
  price: number;
  etaHours: number;
  /** 0-100 — the matcher's confidence in this specific assignment. */
  trustScore: number | null;
  /** Plain-language reason the assigned agent won the match. */
  matchRationale: string | null;
  /** When this task last entered "running" — the monitor's simulation
   * clock for delivery is measured from here. */
  startedAt: string | null;
  /** When this task entered "review" — the monitor's autonomous
   * verification decision is timed from here. */
  reviewStartedAt: string | null;
}

export type EscrowStatus = "locked" | "released" | "refunded" | "disputed";

export interface EscrowTransaction {
  id: string;
  taskId: string;
  agentId: string;
  amount: number;
  status: EscrowStatus;
  createdAt: string;
  releasedAt: string | null;
  /** Real on-chain transaction hash — absent/null under the simulated
   * provider, set once a real on-chain provider confirms the transaction. */
  txHash?: string | null;
  /** Block explorer URL for `txHash`, when there is one. */
  explorerUrl?: string | null;
}

export type ActivityEventType =
  | "goal_created"
  | "goal_completed"
  | "agent_matched"
  | "agent_reassigned"
  | "task_started"
  | "task_delivered"
  | "task_verified"
  | "escrow_locked"
  | "escrow_released"
  | "escrow_refunded";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  message: string;
  createdAt: string;
  goalId: string | null;
  agentId: string | null;
  /** Set only for escrow events settled by a real on-chain provider. */
  txHash?: string | null;
  explorerUrl?: string | null;
}

export interface DashboardStats {
  activeGoalsCount: number;
  jobsCompleted: number;
  totalSpent: number;
  totalSaved: number;
  avgCompletionHours: number;
  topAgent: Pick<Agent, "id" | "name" | "avatarUrl"> | null;
}

export interface VyronUser {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
}

/** Persistent memory: preferences that carry forward and shape future
 * executions (default budget, favorite agents get a matching boost). */
export interface UserPreferences {
  userId: string;
  budget: number | null;
  timezone: string | null;
  preferredStack: string | null;
  favoriteAgentIds: string[];
  /** The last wallet address the user connected — persisted so it's known
   * even before the browser's wallet extension reconnects. */
  walletAddress: string | null;
}
