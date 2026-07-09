import "server-only";
import { isClerkConfigured } from "@/lib/auth-config";

export interface IntegrationStatus {
  key: string;
  label: string;
  configured: boolean;
  description: string;
}

export function getIntegrationStatuses(): IntegrationStatus[] {
  const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);
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
        : "DATABASE_URL is not set — the app cannot read or write any data.",
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
