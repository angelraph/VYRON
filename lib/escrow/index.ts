import "server-only";
import { simulatedEscrowProvider } from "@/lib/escrow/simulated-provider";
import { xLayerEscrowProvider } from "@/lib/escrow/xlayer-provider";
import type { EscrowProvider } from "@/lib/escrow/provider";

export function getEscrowProvider(): EscrowProvider {
  return process.env.ESCROW_PROVIDER === "xlayer"
    ? xLayerEscrowProvider
    : simulatedEscrowProvider;
}

export type { EscrowProvider, EscrowLockParams, EscrowResult } from "@/lib/escrow/provider";
