import { expect } from "chai";
import hre from "hardhat";

describe("Reputation", function () {
  async function deployFixture() {
    const [admin, agentWallet] = await hre.viem.getWalletClients();
    const registry = await hre.viem.deployContract("AgentRegistry", [admin.account.address]);
    const reputation = await hre.viem.deployContract("Reputation", [
      admin.account.address,
      registry.address,
    ]);

    const reputationRole = await registry.read.REPUTATION_ROLE();
    await registry.write.grantRole([reputationRole, reputation.address]);
    await registry.write.registerAgent([agentWallet.account.address, "Agent", [], 1n]);

    return { registry, reputation, admin, agentWallet };
  }

  it("starts every agent at a base score of 500", async function () {
    const { reputation, agentWallet } = await deployFixture();
    expect(await reputation.read.getReputationScore([agentWallet.account.address])).to.equal(500n);
  });

  it("increases reputation on recordSuccess and mirrors it on the registry", async function () {
    const { registry, reputation, agentWallet } = await deployFixture();
    await reputation.write.recordSuccess([agentWallet.account.address, 25n, "task delivered on time"]);

    expect(await reputation.read.getReputationScore([agentWallet.account.address])).to.equal(525n);
    const agent = await registry.read.getAgent([agentWallet.account.address]);
    expect(agent.reputationScore).to.equal(525n);
  });

  it("decreases reputation on recordFailure", async function () {
    const { reputation, agentWallet } = await deployFixture();
    await reputation.write.recordFailure([agentWallet.account.address, 40n, "stalled delivery"]);

    expect(await reputation.read.getReputationScore([agentWallet.account.address])).to.equal(460n);
  });

  it("rejects a zero-amount reputation change", async function () {
    const { reputation, agentWallet } = await deployFixture();
    await expect(
      reputation.write.recordSuccess([agentWallet.account.address, 0n, "n/a"]),
    ).to.be.rejectedWith("ZeroAmount");
  });

  it("rejects calls from a non-orchestrator", async function () {
    const { reputation, agentWallet } = await deployFixture();
    const [, , stranger] = await hre.viem.getWalletClients();
    const reputationAsStranger = await hre.viem.getContractAt(
      "Reputation",
      reputation.address,
      { client: { wallet: stranger } },
    );

    await expect(
      reputationAsStranger.write.recordSuccess([agentWallet.account.address, 10n, "n/a"]),
    ).to.be.rejected;
  });
});
