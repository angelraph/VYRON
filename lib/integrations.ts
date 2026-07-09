import "server-only";
import { isClerkConfigured } from "@/lib/auth-config";
import { isDatabaseConfigured } from "@/lib/db";

export interface IntegrationStatus {
  key: string;
  label: string;
  configured: boolean;
  description: string;
}

export function getIntegrationStatuses(): IntegrationStatus[] {
  return [
    {
      key: "clerk",
      label: "Authentication (Clerk)",
      configured: isClerkConfigured,
      description: isClerkConfigured
        ? "Real accounts via Clerk."
        : "Running as a fixed demo identity.",
    },
    {
      key: "database",
      label: "Database (Supabase / Postgres)",
      configured: isDatabaseConfigured,
      description: isDatabaseConfigured
        ? "Reading and writing to your Postgres database."
        : "Serving seeded demo data — no database connected.",
    },
    {
      key: "ai",
      label: "AI model (Vercel AI SDK)",
      configured: Boolean(process.env.OPENAI_API_KEY),
      description: process.env.OPENAI_API_KEY
        ? "Goal Interpreter and matching use a live model."
        : "Goal Interpreter falls back to a local heuristic planner.",
    },
    {
      key: "escrow",
      label: "Escrow settlement",
      configured: process.env.ESCROW_PROVIDER === "xlayer",
      description:
        process.env.ESCROW_PROVIDER === "xlayer"
          ? "Settling with real transactions on X Layer Testnet."
          : "Simulated escrow — the X Layer provider is fully built (contracts, tests, integration) but not yet deployed/activated.",
    },
  ];
}
