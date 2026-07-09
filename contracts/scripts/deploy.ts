import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

/** Deploys Escrow, AgentRegistry, and Reputation (in that order, since
 * Reputation needs AgentRegistry's address), wires up cross-contract
 * roles, and writes the resulting addresses to deployments/<network>.json
 * so the app's xLayerEscrowProvider can pick them up. */
async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  const admin = deployer.account.address;

  console.log(`Deploying from ${admin} on ${hre.network.name}...`);

  const escrow = await hre.viem.deployContract("Escrow", [admin]);
  console.log(`Escrow deployed at ${escrow.address}`);

  const agentRegistry = await hre.viem.deployContract("AgentRegistry", [admin]);
  console.log(`AgentRegistry deployed at ${agentRegistry.address}`);

  const reputation = await hre.viem.deployContract("Reputation", [admin, agentRegistry.address]);
  console.log(`Reputation deployed at ${reputation.address}`);

  const reputationRole = await agentRegistry.read.REPUTATION_ROLE();
  await agentRegistry.write.grantRole([reputationRole, reputation.address]);
  console.log(`Granted REPUTATION_ROLE on AgentRegistry to Reputation contract`);

  const output = {
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    deployer: admin,
    contracts: {
      Escrow: escrow.address,
      AgentRegistry: agentRegistry.address,
      Reputation: reputation.address,
    },
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${hre.network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log(`\nWrote deployment record to ${outFile}`);
  console.log(`\nAdd these to .env.local:`);
  console.log(`ESCROW_CONTRACT_ADDRESS="${escrow.address}"`);
  console.log(`AGENT_REGISTRY_CONTRACT_ADDRESS="${agentRegistry.address}"`);
  console.log(`REPUTATION_CONTRACT_ADDRESS="${reputation.address}"`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
