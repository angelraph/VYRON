import "server-only";
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { xLayerRpcUrl, xLayerTestnet } from "@/lib/web3/config";
import { escrowAbi } from "@/lib/web3/abis";
import type { EscrowLockParams, EscrowProvider, EscrowResult } from "@/lib/escrow/provider";

/** Demo-only USD -> native-token conversion. Task prices in this app are
 * dollar-denominated and there's no real price oracle wired up — this
 * fixed rate just keeps testnet transactions small and safe regardless of
 * a task's dollar amount. Replace with a real price feed before any
 * mainnet use. */
const DEMO_USD_TO_OKB_RATE = 0.0001;

function usdToWei(amountUsd: number): bigint {
  return parseEther((amountUsd * DEMO_USD_TO_OKB_RATE).toFixed(18));
}

function explorerTxUrl(hash: string): string {
  return `${xLayerTestnet.blockExplorers.default.url}/tx/${hash}`;
}

/** Our escrow ids are opaque strings everywhere else in the app; here they
 * encode the on-chain uint256 escrowId so release/refund know which entry
 * to call back into, without a separate persisted mapping. */
function encodeEscrowId(onChainId: bigint): string {
  return `onchain-${onChainId.toString()}`;
}

function decodeEscrowId(id: string): bigint {
  const match = /^onchain-(\d+)$/.exec(id);
  if (!match) {
    throw new Error(`"${id}" is not an on-chain escrow id (expected "onchain-<n>")`);
  }
  return BigInt(match[1]);
}

function getClients() {
  const privateKey = process.env.ORCHESTRATOR_PRIVATE_KEY;
  const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS;
  if (!privateKey || !escrowAddress) {
    throw new Error(
      "xLayerEscrowProvider requires ORCHESTRATOR_PRIVATE_KEY and ESCROW_CONTRACT_ADDRESS to be set. Set ESCROW_PROVIDER=simulated until contracts are deployed and configured.",
    );
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const transport = http(xLayerRpcUrl);
  const publicClient = createPublicClient({ chain: xLayerTestnet, transport });
  const walletClient = createWalletClient({ account, chain: xLayerTestnet, transport });

  return { publicClient, walletClient, account, escrowAddress: escrowAddress as `0x${string}` };
}

/** Real on-chain escrow on X Layer Testnet, backed by the Escrow.sol
 * contract in contracts/contracts/Escrow.sol. Every lock/release/refund is
 * an actual transaction, confirmed (receipt awaited) before this returns —
 * "confirmed" in the UI means exactly that, not a guess. */
export const xLayerEscrowProvider: EscrowProvider = {
  name: "xlayer",

  async lock({ taskId, agentId, amount, agentWalletAddress }: EscrowLockParams): Promise<EscrowResult> {
    if (!agentWalletAddress) {
      throw new Error(
        `Cannot lock real escrow for agent ${agentId}: no on-chain wallet address is configured for them.`,
      );
    }

    const { publicClient, walletClient, account, escrowAddress } = getClients();
    const value = usdToWei(amount);

    const { request, result: onChainId } = await publicClient.simulateContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "lockFunds",
      args: [agentWalletAddress as `0x${string}`],
      value,
      account,
    });
    const hash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash });

    return {
      id: encodeEscrowId(onChainId),
      taskId,
      agentId,
      amount,
      status: "locked",
      createdAt: new Date().toISOString(),
      releasedAt: null,
      txHash: hash,
      explorerUrl: explorerTxUrl(hash),
    };
  },

  async release(escrowId: string): Promise<EscrowResult> {
    const onChainId = decodeEscrowId(escrowId);
    const { publicClient, walletClient, account, escrowAddress } = getClients();

    const { request } = await publicClient.simulateContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "releaseFunds",
      args: [onChainId],
      account,
    });
    const hash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash });

    const entry = await publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "getEscrow",
      args: [onChainId],
    });
    const releasedAt = new Date().toISOString();

    return {
      id: escrowId,
      taskId: "",
      agentId: entry.agent,
      amount: Number(entry.amount) / 1e18 / DEMO_USD_TO_OKB_RATE,
      status: "released",
      createdAt: releasedAt,
      releasedAt,
      txHash: hash,
      explorerUrl: explorerTxUrl(hash),
    };
  },

  async refund(escrowId: string): Promise<EscrowResult> {
    const onChainId = decodeEscrowId(escrowId);
    const { publicClient, walletClient, account, escrowAddress } = getClients();

    const { request } = await publicClient.simulateContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "refundFunds",
      args: [onChainId],
      account,
    });
    const hash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash });

    const entry = await publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "getEscrow",
      args: [onChainId],
    });

    return {
      id: escrowId,
      taskId: "",
      agentId: entry.agent,
      amount: Number(entry.amount) / 1e18 / DEMO_USD_TO_OKB_RATE,
      status: "refunded",
      createdAt: new Date().toISOString(),
      releasedAt: null,
      txHash: hash,
      explorerUrl: explorerTxUrl(hash),
    };
  },
};
