import { PrismaClient } from "@prisma/client";
import {
  DEMO_USER_ID,
  MOCK_ACTIVITY_EVENTS,
  MOCK_AGENTS,
  MOCK_ESCROW_TRANSACTIONS,
  MOCK_GOALS,
  MOCK_USER_PREFERENCES,
  MOCK_WORKFLOW_TASKS,
} from "../lib/mock-data";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: "founder@vyron.dev",
      name: "Demo Founder",
      budget: MOCK_USER_PREFERENCES.budget,
      timezone: MOCK_USER_PREFERENCES.timezone,
      preferredStack: MOCK_USER_PREFERENCES.preferredStack,
      favoriteAgentIds: MOCK_USER_PREFERENCES.favoriteAgentIds,
    },
  });

  for (const agent of MOCK_AGENTS) {
    await prisma.agent.upsert({
      where: { id: agent.id },
      update: agent,
      create: agent,
    });
  }

  for (const goal of MOCK_GOALS) {
    await prisma.goal.upsert({
      where: { id: goal.id },
      update: goal,
      create: goal,
    });
  }

  for (const task of MOCK_WORKFLOW_TASKS) {
    await prisma.workflowTask.upsert({
      where: { id: task.id },
      update: task,
      create: task,
    });
  }

  for (const tx of MOCK_ESCROW_TRANSACTIONS) {
    await prisma.escrowTransaction.upsert({
      where: { id: tx.id },
      update: tx,
      create: tx,
    });
  }

  for (const event of MOCK_ACTIVITY_EVENTS) {
    await prisma.activityEvent.upsert({
      where: { id: event.id },
      update: event,
      create: event,
    });
  }

  console.log(
    `Seeded ${MOCK_AGENTS.length} agents, ${MOCK_GOALS.length} goals, ${MOCK_WORKFLOW_TASKS.length} tasks.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
