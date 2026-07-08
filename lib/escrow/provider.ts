import type { EscrowStatus } from "@/lib/types";

export interface EscrowLockParams {
  taskId: string;
  agentId: string;
  amount: number;
}

export interface EscrowResult {
  id: string;
  taskId: string;
  agentId: string;
  amount: number;
  status: EscrowStatus;
  createdAt: string;
  releasedAt: string | null;
}

/** The seam between the execution pipeline and however funds actually move.
 * `SimulatedEscrowProvider` implements this today; a real on-chain provider
 * (X Layer) implements the same three methods later — the engine, the
 * activity feed, and the UI never need to know which one is active. */
export interface EscrowProvider {
  readonly name: string;
  lock(params: EscrowLockParams): Promise<EscrowResult>;
  release(escrowId: string): Promise<EscrowResult>;
  refund(escrowId: string): Promise<EscrowResult>;
}
