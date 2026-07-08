import "server-only";
import { mockStore } from "@/lib/mock-store";
import type { EscrowLockParams, EscrowProvider, EscrowResult } from "@/lib/escrow/provider";

const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

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

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Today's escrow behavior: an honest in-app state machine, not a real
 * chain call. Locks, releases, and refunds are all real writes against the
 * same data layer the rest of the app reads from. */
export const simulatedEscrowProvider: EscrowProvider = {
  name: "simulated",

  async lock({ taskId, agentId, amount }: EscrowLockParams): Promise<EscrowResult> {
    const tx: EscrowResult = {
      id: newId("escrow"),
      taskId,
      agentId,
      amount,
      status: "locked",
      createdAt: new Date().toISOString(),
      releasedAt: null,
    };

    if (!isDatabaseConfigured) {
      mockStore.escrow.push(tx);
      return tx;
    }

    const prisma = await getPrisma();
    await prisma.escrowTransaction.create({
      data: { id: tx.id, taskId, agentId, amount, status: "locked" },
    });
    return tx;
  },

  async release(escrowId: string): Promise<EscrowResult> {
    const releasedAt = new Date().toISOString();

    if (!isDatabaseConfigured) {
      const tx = mockStore.escrow.find((entry) => entry.id === escrowId);
      if (!tx) throw new Error(`Escrow transaction ${escrowId} not found`);
      tx.status = "released";
      tx.releasedAt = releasedAt;
      return tx;
    }

    const prisma = await getPrisma();
    const updated = await prisma.escrowTransaction.update({
      where: { id: escrowId },
      data: { status: "released", releasedAt: new Date(releasedAt) },
    });
    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      releasedAt: updated.releasedAt?.toISOString() ?? releasedAt,
    };
  },

  async refund(escrowId: string): Promise<EscrowResult> {
    if (!isDatabaseConfigured) {
      const tx = mockStore.escrow.find((entry) => entry.id === escrowId);
      if (!tx) throw new Error(`Escrow transaction ${escrowId} not found`);
      tx.status = "refunded";
      return tx;
    }

    const prisma = await getPrisma();
    const updated = await prisma.escrowTransaction.update({
      where: { id: escrowId },
      data: { status: "refunded" },
    });
    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      releasedAt: updated.releasedAt?.toISOString() ?? null,
    };
  },
};
