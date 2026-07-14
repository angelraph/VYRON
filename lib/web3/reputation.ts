import "server-only";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { acquireWalletLock, releaseWalletLock } from "@/lib/db";
import { xLayerRpcUrl, xLayerTestnet } from "@/lib/web3/config";
import { agentRegistryAbi, reputationAbi } from "@/lib/web3/abis";
import type { Agent } from "@/lib/types";

/** Narrowed the same way executor.ts's ExecuteContext is — only the fields
 * actually read here, so ad-hoc callers don't need to fabricate a full
 * Agent row. */
type OnChainAgent = Pick<Agent, "walletAddress" | "name" | "specializations" | "pricePerTask">;

/** Same feature gate as lib/escrow/index.ts — AgentRegistry/Reputation
 * only get real writes once the operator has actually deployed and
 * switched escrow on; before that every call here is a silent no-op so
 * local/simulated dev keeps working unchanged. */
function isOnChainEnabled(): boolean {
  return process.env.ESCROW_PROVIDER === "xlayer";
}

function getClients() {
  const privateKey = process.env.ORCHESTRATOR_PRIVATE_KEY;
  const agentRegistryAddress = process.env.AGENT_REGISTRY_CONTRACT_ADDRESS;
  const reputationAddress = process.env.REPUTATION_CONTRACT_ADDRESS;
  if (!privateKey || !agentRegistryAddress || !reputationAddress) return null;

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const transport = http(xLayerRpcUrl);
  return {
    publicClient: createPublicClient({ chain: xLayerTestnet, transport }),
    walletClient: createWalletClient({ account, chain: xLayerTestnet, transport }),
    account,
    agentRegistryAddress: agentRegistryAddress as `0x${string}`,
    reputationAddress: reputationAddress as `0x${string}`,
  };
}

/** Registers an agent's wallet in the on-chain AgentRegistry if it isn't
 * already there. Idempotent by design: `isRegistered` is checked first, so
 * calling this repeatedly (e.g. before every reputation write) is cheap and
 * safe. Note: every marketplace agent in this deployment currently shares
 * the same payout wallet as the orchestrator (see
 * project_escrow_live_xlayer_testnet memory) — until agents get distinct
 * real wallets, this registers that one shared address once, and every
 * agent's reputation events accumulate onto that single on-chain identity.
 * Never throws for callers with on-chain disabled or misconfigured; errors
 * from an actually-attempted chain write still propagate. */
export async function ensureAgentRegisteredOnChain(agent: OnChainAgent): Promise<void> {
  if (!isOnChainEnabled() || !agent.walletAddress) return;
  const clients = getClients();
  if (!clients) return;
  const { publicClient, walletClient, account, agentRegistryAddress } = clients;
  const agentAddress = agent.walletAddress as `0x${string}`;

  const alreadyRegistered = await publicClient.readContract({
    address: agentRegistryAddress,
    abi: agentRegistryAbi,
    functionName: "isRegistered",
    args: [agentAddress],
  });
  if (alreadyRegistered) return;

  await acquireWalletLock();
  try {
    const { request } = await publicClient.simulateContract({
      address: agentRegistryAddress,
      abi: agentRegistryAbi,
      functionName: "registerAgent",
      args: [agentAddress, agent.name, agent.specializations, BigInt(Math.max(0, Math.round(agent.pricePerTask)))],
      account,
    });
    const hash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash });
  } finally {
    await releaseWalletLock();
  }
}

async function recordReputation(
  functionName: "recordSuccess" | "recordFailure",
  agent: OnChainAgent,
  amount: number,
  reason: string,
): Promise<void> {
  if (!isOnChainEnabled() || !agent.walletAddress) return;
  const clients = getClients();
  if (!clients) return;

  await ensureAgentRegisteredOnChain(agent);

  const { publicClient, walletClient, account, reputationAddress } = clients;
  await acquireWalletLock();
  try {
    const { request } = await publicClient.simulateContract({
      address: reputationAddress,
      abi: reputationAbi,
      functionName,
      args: [agent.walletAddress as `0x${string}`, BigInt(Math.max(1, Math.round(amount))), reason.slice(0, 200)],
      account,
    });
    const hash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash });
  } finally {
    await releaseWalletLock();
  }
}

/** Records a real reputation gain after a verified, paid task — called
 * right alongside the real escrow release, not a fabricated score. */
export async function recordOnChainReputationSuccess(
  agent: OnChainAgent,
  qualityScore: number,
  reason: string,
): Promise<void> {
  await recordReputation("recordSuccess", agent, qualityScore, reason);
}

/** Records a real reputation loss after a genuine failure (stalled
 * delivery, repeated rejected review) that triggered reassignment. */
export async function recordOnChainReputationFailure(agent: OnChainAgent, reason: string): Promise<void> {
  await recordReputation("recordFailure", agent, 50, reason);
}

export async function getOnChainReputationScore(walletAddress: string): Promise<number | null> {
  if (!isOnChainEnabled()) return null;
  const clients = getClients();
  if (!clients) return null;
  const score = await clients.publicClient.readContract({
    address: clients.agentRegistryAddress,
    abi: agentRegistryAbi,
    functionName: "getReputationScore",
    args: [walletAddress as `0x${string}`],
  });
  return Number(score);
}
