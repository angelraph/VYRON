import type { EscrowStatus } from "@/lib/types";

export interface EscrowLockParams {
  taskId: string;
  agentId: string;
  amount: number;
  /** The agent's on-chain payout address, resolved by the caller (avoids
   * a circular import back into the data layer). Only the xlayer provider
   * needs this — it fails loudly if a real lock is attempted without one. */
  agentWalletAddress?: string | null;
}

export interface EscrowResult {
  id: string;
  taskId: string;
  agentId: string;
  amount: number;
  status: EscrowStatus;
  createdAt: string;
  releasedAt: string | null;
  /** Real on-chain transaction hash for this state change — absent under
   * the simulated provider. Presence implies the transaction was
   * confirmed; providers only return after waiting for the receipt. */
  txHash?: string | null;
  /** Block explorer URL for `txHash`, when there is one. */
  explorerUrl?: string | null;
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
