import type { EscrowProvider } from "@/lib/escrow/provider";

/** Stub seam for real on-chain escrow on the OKX X Layer. Wire in wallet
 * connection, contract calls (lock/release/refund), and confirmation
 * polling here. The execution engine, activity feed, and UI already talk
 * only to the `EscrowProvider` interface, so swapping this in for
 * `simulatedEscrowProvider` (via `ESCROW_PROVIDER=xlayer`) needs no changes
 * anywhere else in the pipeline. */
export const xLayerEscrowProvider: EscrowProvider = {
  name: "xlayer",

  async lock() {
    throw new Error(
      "X Layer escrow integration is not implemented yet — set ESCROW_PROVIDER=simulated.",
    );
  },

  async release() {
    throw new Error(
      "X Layer escrow integration is not implemented yet — set ESCROW_PROVIDER=simulated.",
    );
  },

  async refund() {
    throw new Error(
      "X Layer escrow integration is not implemented yet — set ESCROW_PROVIDER=simulated.",
    );
  },
};
