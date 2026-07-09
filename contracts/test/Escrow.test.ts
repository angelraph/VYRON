import { expect } from "chai";
import hre from "hardhat";
import { getAddress, parseEther } from "viem";

describe("Escrow", function () {
  async function deployFixture() {
    const [admin, agent, other] = await hre.viem.getWalletClients();
    const escrow = await hre.viem.deployContract("Escrow", [admin.account.address]);
    const publicClient = await hre.viem.getPublicClient();
    return { escrow, admin, agent, other, publicClient };
  }

  it("locks funds and records payer, agent, amount, and Locked status", async function () {
    const { escrow, admin, agent } = await deployFixture();
    const amount = parseEther("1");

    await escrow.write.lockFunds([agent.account.address], { value: amount });

    const entry = await escrow.read.getEscrow([1n]);
    expect(entry.payer).to.equal(getAddress(admin.account.address));
    expect(entry.agent).to.equal(getAddress(agent.account.address));
    expect(entry.amount).to.equal(amount);
    expect(entry.status).to.equal(1); // Locked
  });

  it("emits EscrowLocked", async function () {
    const { escrow, agent, publicClient } = await deployFixture();
    const hash = await escrow.write.lockFunds([agent.account.address], {
      value: parseEther("1"),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const logs = await escrow.getEvents.EscrowLocked();
    expect(logs).to.have.lengthOf(1);
    expect(receipt.status).to.equal("success");
  });

  it("releases funds to the agent and marks Released", async function () {
    const { escrow, agent, publicClient } = await deployFixture();
    await escrow.write.lockFunds([agent.account.address], { value: parseEther("1") });

    const before = await publicClient.getBalance({ address: agent.account.address });
    await escrow.write.releaseFunds([1n]);
    const after = await publicClient.getBalance({ address: agent.account.address });

    expect(after - before).to.equal(parseEther("1"));
    const entry = await escrow.read.getEscrow([1n]);
    expect(entry.status).to.equal(2); // Released
  });

  it("refunds funds to the payer and marks Refunded", async function () {
    const { escrow, admin, agent, publicClient } = await deployFixture();
    await escrow.write.lockFunds([agent.account.address], { value: parseEther("1") });

    const before = await publicClient.getBalance({ address: admin.account.address });
    const hash = await escrow.write.refundFunds([1n]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;
    const after = await publicClient.getBalance({ address: admin.account.address });

    expect(after - before + gasCost).to.equal(parseEther("1"));
    const entry = await escrow.read.getEscrow([1n]);
    expect(entry.status).to.equal(3); // Refunded
  });

  it("prevents double withdrawal via release-then-release", async function () {
    const { escrow, agent } = await deployFixture();
    await escrow.write.lockFunds([agent.account.address], { value: parseEther("1") });
    await escrow.write.releaseFunds([1n]);

    await expect(escrow.write.releaseFunds([1n])).to.be.rejectedWith("EscrowNotLocked");
  });

  it("prevents double withdrawal via release-then-refund", async function () {
    const { escrow, agent } = await deployFixture();
    await escrow.write.lockFunds([agent.account.address], { value: parseEther("1") });
    await escrow.write.releaseFunds([1n]);

    await expect(escrow.write.refundFunds([1n])).to.be.rejectedWith("EscrowNotLocked");
  });

  it("rejects lockFunds from a non-orchestrator caller", async function () {
    const { escrow, agent, other } = await deployFixture();
    const escrowAsOther = await hre.viem.getContractAt("Escrow", escrow.address, {
      client: { wallet: other },
    });

    await expect(
      escrowAsOther.write.lockFunds([agent.account.address], { value: parseEther("1") }),
    ).to.be.rejected;
  });

  it("rejects locking zero value", async function () {
    const { escrow, agent } = await deployFixture();
    await expect(
      escrow.write.lockFunds([agent.account.address], { value: 0n }),
    ).to.be.rejectedWith("ZeroAmount");
  });

  it("rejects locking to the zero address", async function () {
    const { escrow } = await deployFixture();
    await expect(
      escrow.write.lockFunds(["0x0000000000000000000000000000000000000000"], {
        value: parseEther("1"),
      }),
    ).to.be.rejectedWith("ZeroAddress");
  });
});
