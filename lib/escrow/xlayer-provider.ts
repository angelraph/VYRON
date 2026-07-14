import "server-only";
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { acquireWalletLock, releaseWalletLock } from "@/lib/db";
import { xLayerRpcUrl, xLayerTestnet } from "@/lib/web3/config";
import { escrowAbi } from "@/lib/web3/abis";
import type { EscrowLockParams, EscrowProvider, EscrowResult } from "@/lib/escrow/provider";

/** Same singleton key `simulated-provider.ts` uses — both providers share
 * one Prisma client. The chain is the source of truth for the funds
 * themselves, but `settleTask`/`getLockedEscrow` (lib/engine/memory.ts,
 * lib/db.ts) only ever look in Postgres to decide what needs releasing —
 * without mirroring lock/release/refund here, a real on-chain lock becomes
 * invisible to the rest of the app and can never be released. */
async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  const globalForPrisma = globalThis as unknown as {
    prisma?: InstanceType<typeof PrismaClient>;
  };
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

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

    // The orchestrator wallet is shared across every concurrent invocation
    // on Vercel serverless; without serializing writes here, two overlapping
    // lock/release/refund calls can each fetch the same "next" nonce before
    // either confirms, and whichever loses just throws -- silently, since
    // nothing here retries it. See the schema comment on WalletLock.
    let onChainId: bigint;
    let hash: `0x${string}`;
    await acquireWalletLock();
    try {
      const simulated = await publicClient.simulateContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "lockFunds",
        args: [agentWalletAddress as `0x${string}`],
        value,
        account,
      });
      onChainId = simulated.result;
      hash = await walletClient.writeContract(simulated.request);
      await publicClient.waitForTransactionReceipt({ hash });
    } finally {
      await releaseWalletLock();
    }

    const id = encodeEscrowId(onChainId);
    const explorerUrl = explorerTxUrl(hash);
    const prisma = await getPrisma();
    await prisma.escrowTransaction.create({
      data: { id, taskId, agentId, amount, status: "locked", txHash: hash, explorerUrl },
    });

    return {
      id,
      taskId,
      agentId,
      amount,
      status: "locked",
      createdAt: new Date().toISOString(),
      releasedAt: null,
      txHash: hash,
      explorerUrl,
    };
  },

  async release(escrowId: string): Promise<EscrowResult> {
    const onChainId = decodeEscrowId(escrowId);
    const { publicClient, walletClient, account, escrowAddress } = getClients();

    let hash: `0x${string}`;
    await acquireWalletLock();
    try {
      const { request } = await publicClient.simulateContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "releaseFunds",
        args: [onChainId],
        account,
      });
      hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
    } finally {
      await releaseWalletLock();
    }

    const entry = await publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "getEscrow",
      args: [onChainId],
    });
    const releasedAt = new Date().toISOString();
    const explorerUrl = explorerTxUrl(hash);

    const prisma = await getPrisma();
    const updated = await prisma.escrowTransaction.update({
      where: { id: escrowId },
      data: { status: "released", releasedAt: new Date(), txHash: hash, explorerUrl },
    });

    return {
      id: escrowId,
      taskId: updated.taskId,
      agentId: entry.agent,
      amount: Number(entry.amount) / 1e18 / DEMO_USD_TO_OKB_RATE,
      status: "released",
      createdAt: releasedAt,
      releasedAt,
      txHash: hash,
      explorerUrl,
    };
  },

  async refund(escrowId: string): Promise<EscrowResult> {
    const onChainId = decodeEscrowId(escrowId);
    const { publicClient, walletClient, account, escrowAddress } = getClients();

    let hash: `0x${string}`;
    await acquireWalletLock();
    try {
      const { request } = await publicClient.simulateContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "refundFunds",
        args: [onChainId],
        account,
      });
      hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
    } finally {
      await releaseWalletLock();
    }

    const entry = await publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "getEscrow",
      args: [onChainId],
    });
    const explorerUrl = explorerTxUrl(hash);

    const prisma = await getPrisma();
    const updated = await prisma.escrowTransaction.update({
      where: { id: escrowId },
      data: { status: "refunded", txHash: hash, explorerUrl },
    });

    return {
      id: escrowId,
      taskId: updated.taskId,
      agentId: entry.agent,
      amount: Number(entry.amount) / 1e18 / DEMO_USD_TO_OKB_RATE,
      status: "refunded",
      createdAt: new Date().toISOString(),
      releasedAt: null,
      txHash: hash,
      explorerUrl,
    };
  },
};
