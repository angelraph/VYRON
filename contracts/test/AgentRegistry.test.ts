import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";

describe("AgentRegistry", function () {
  async function deployFixture() {
    const [admin, agentWallet, other] = await hre.viem.getWalletClients();
    const registry = await hre.viem.deployContract("AgentRegistry", [admin.account.address]);
    return { registry, admin, agentWallet, other };
  }

  it("registers an agent with skills, pricing, and default availability/reputation", async function () {
    const { registry, agentWallet } = await deployFixture();

    await registry.write.registerAgent([
      agentWallet.account.address,
      "Atlas Research Co.",
      ["Research", "Data Analysis"],
      parseEther("0.05"),
    ]);

    const agent = await registry.read.getAgent([agentWallet.account.address]);
    expect(agent.exists).to.equal(true);
    expect(agent.name).to.equal("Atlas Research Co.");
    expect(agent.skills).to.deep.equal(["Research", "Data Analysis"]);
    expect(agent.pricePerTask).to.equal(parseEther("0.05"));
    expect(agent.availability).to.equal(0); // Available
    expect(agent.reputationScore).to.equal(500n);
  });

  it("rejects registering the same agent twice", async function () {
    const { registry, agentWallet } = await deployFixture();
    await registry.write.registerAgent([agentWallet.account.address, "Agent", [], 1n]);

    await expect(
      registry.write.registerAgent([agentWallet.account.address, "Agent", [], 1n]),
    ).to.be.rejectedWith("AgentAlreadyRegistered");
  });

  it("updates availability, skills, and pricing", async function () {
    const { registry, agentWallet } = await deployFixture();
    await registry.write.registerAgent([agentWallet.account.address, "Agent", ["A"], 1n]);

    await registry.write.updateAvailability([agentWallet.account.address, 2]); // Offline
    await registry.write.updateSkills([agentWallet.account.address, ["A", "B"]]);
    await registry.write.updatePricing([agentWallet.account.address, 42n]);

    const agent = await registry.read.getAgent([agentWallet.account.address]);
    expect(agent.availability).to.equal(2);
    expect(agent.skills).to.deep.equal(["A", "B"]);
    expect(agent.pricePerTask).to.equal(42n);
  });

  it("rejects updates for an unregistered agent", async function () {
    const { registry, other } = await deployFixture();
    await expect(
      registry.write.updatePricing([other.account.address, 1n]),
    ).to.be.rejectedWith("AgentNotRegistered");
  });

  it("only allows REPUTATION_ROLE to apply reputation deltas", async function () {
    const { registry, admin, agentWallet, other } = await deployFixture();
    await registry.write.registerAgent([agentWallet.account.address, "Agent", [], 1n]);

    const registryAsOther = await hre.viem.getContractAt("AgentRegistry", registry.address, {
      client: { wallet: other },
    });
    await expect(
      registryAsOther.write.applyReputationDelta([agentWallet.account.address, 10n]),
    ).to.be.rejected;

    const reputationRole = await registry.read.REPUTATION_ROLE();
    await registry.write.grantRole([reputationRole, other.account.address]);
    await registryAsOther.write.applyReputationDelta([agentWallet.account.address, 10n]);

    const agent = await registry.read.getAgent([agentWallet.account.address]);
    expect(agent.reputationScore).to.equal(510n);
  });

  it("lists all registered agent addresses", async function () {
    const { registry, agentWallet, other } = await deployFixture();
    await registry.write.registerAgent([agentWallet.account.address, "A", [], 1n]);
    await registry.write.registerAgent([other.account.address, "B", [], 1n]);

    const all = await registry.read.getAllAgents();
    expect(all.map((address) => address.toLowerCase())).to.deep.equal([
      agentWallet.account.address.toLowerCase(),
      other.account.address.toLowerCase(),
    ]);
  });
});
