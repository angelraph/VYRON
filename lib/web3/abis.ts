import { parseAbi } from "viem";

/** Minimal ABIs for the subset of each contract VYRON's backend actually
 * calls. Kept hand-written and in sync with contracts/contracts/*.sol
 * rather than importing Hardhat build artifacts across the package
 * boundary — the two projects intentionally don't share a build step. */

export const escrowAbi = parseAbi([
  "function lockFunds(address agent) payable returns (uint256 escrowId)",
  "function releaseFunds(uint256 escrowId)",
  "function refundFunds(uint256 escrowId)",
  "function getEscrow(uint256 escrowId) view returns ((address payer, address agent, uint256 amount, uint8 status))",
  "event EscrowLocked(uint256 indexed escrowId, address indexed payer, address indexed agent, uint256 amount)",
  "event EscrowReleased(uint256 indexed escrowId, address indexed agent, uint256 amount)",
  "event EscrowRefunded(uint256 indexed escrowId, address indexed payer, uint256 amount)",
]);

export const agentRegistryAbi = parseAbi([
  "function registerAgent(address agent, string name, string[] skills, uint256 pricePerTask)",
  "function updateAvailability(address agent, uint8 availability)",
  "function updateSkills(address agent, string[] skills)",
  "function updatePricing(address agent, uint256 pricePerTask)",
  "function getAgent(address agent) view returns ((bool exists, string name, string[] skills, uint256 pricePerTask, uint8 availability, int256 reputationScore))",
  "function getReputationScore(address agent) view returns (int256)",
  "function isRegistered(address agent) view returns (bool)",
]);

export const reputationAbi = parseAbi([
  "function recordSuccess(address agent, int256 amount, string reason)",
  "function recordFailure(address agent, int256 amount, string reason)",
  "function getReputationScore(address agent) view returns (int256)",
]);
