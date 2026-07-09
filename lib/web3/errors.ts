import {
  ResourceUnavailableRpcError,
  SwitchChainError,
  UserRejectedRequestError,
} from "viem";
import { ChainNotConfiguredError, ProviderNotFoundError } from "wagmi";

/** Maps the handful of real error shapes wagmi/viem actually throw during
 * connect/switch-chain into copy a non-technical user can act on, instead
 * of a bare "Something went wrong" or a raw RPC error message. */
export function describeWalletError(error: unknown, walletName: string): string {
  if (error instanceof ProviderNotFoundError) {
    return `${walletName} extension not detected. Install it, then refresh the page and try again.`;
  }
  if (error instanceof UserRejectedRequestError) {
    return `Request rejected in ${walletName}.`;
  }
  if (error instanceof ChainNotConfiguredError) {
    return `${walletName} doesn't support X Layer Testnet. Add the network in your wallet and try again.`;
  }
  if (error instanceof SwitchChainError) {
    return `${walletName} couldn't switch to X Layer Testnet. Switch (or add) the network manually in your wallet and try again.`;
  }
  if (error instanceof ResourceUnavailableRpcError) {
    return `${walletName} already has a pending request — open your wallet to complete or dismiss it.`;
  }
  if (error instanceof Error && error.message) return error.message;
  return `Couldn't connect ${walletName}. Try again.`;
}
