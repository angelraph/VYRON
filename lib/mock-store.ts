import "server-only";
import {
  MOCK_ACTIVITY_EVENTS,
  MOCK_AGENTS,
  MOCK_ESCROW_TRANSACTIONS,
  MOCK_GOALS,
  MOCK_USER_PREFERENCES,
  MOCK_WORKFLOW_TASKS,
} from "@/lib/mock-data";
import type {
  ActivityEvent,
  Agent,
  EscrowTransaction,
  Goal,
  UserPreferences,
  WorkflowTask,
} from "@/lib/types";

interface MockStore {
  goals: Goal[];
  tasks: WorkflowTask[];
  escrow: EscrowTransaction[];
  activity: ActivityEvent[];
  agents: Agent[];
  /** Keyed by userId. */
  preferences: Map<string, UserPreferences>;
  /** Keyed by `${userId}:${agentId}`. */
  affinity: Map<string, number>;
}

declare global {
  var __vyronMockStore: MockStore | undefined;
}

/** A process-lifetime mutable copy of the seed data. Next.js keeps modules
 * warm across requests in a single dev/server process, so goals (and now
 * preferences, availability, and affinity) created during a demo persist
 * for that session without needing a real database. */
function createStore(): MockStore {
  return {
    goals: [...MOCK_GOALS],
    tasks: [...MOCK_WORKFLOW_TASKS],
    escrow: [...MOCK_ESCROW_TRANSACTIONS],
    activity: [...MOCK_ACTIVITY_EVENTS],
    agents: MOCK_AGENTS.map((agent) => ({ ...agent })),
    preferences: new Map([[MOCK_USER_PREFERENCES.userId, { ...MOCK_USER_PREFERENCES }]]),
    affinity: new Map(),
  };
}

export const mockStore = globalThis.__vyronMockStore ?? createStore();
globalThis.__vyronMockStore = mockStore;
