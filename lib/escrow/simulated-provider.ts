import "server-only";
import type { EscrowLockParams, EscrowProvider, EscrowResult } from "@/lib/escrow/provider";

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
    const id = newId("escrow");
    const prisma = await getPrisma();
    const tx = await prisma.escrowTransaction.create({
      data: { id, taskId, agentId, amount, status: "locked" },
    });
    return {
      ...tx,
      createdAt: tx.createdAt.toISOString(),
      releasedAt: tx.releasedAt ? tx.releasedAt.toISOString() : null,
    };
  },

  async release(escrowId: string): Promise<EscrowResult> {
    const prisma = await getPrisma();
    const updated = await prisma.escrowTransaction.update({
      where: { id: escrowId },
      data: { status: "released", releasedAt: new Date() },
    });
    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      releasedAt: updated.releasedAt ? updated.releasedAt.toISOString() : null,
    };
  },

  async refund(escrowId: string): Promise<EscrowResult> {
    const prisma = await getPrisma();
    const updated = await prisma.escrowTransaction.update({
      where: { id: escrowId },
      data: { status: "refunded" },
    });
    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      releasedAt: updated.releasedAt ? updated.releasedAt.toISOString() : null,
    };
  },
};
