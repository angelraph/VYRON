import type { LucideIcon } from "lucide-react";
import {
  Brain,
  Coins,
  Gauge,
  History,
  LayoutDashboard,
  Layers,
  ListChecks,
  Plus,
  Radar,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  Workflow,
} from "lucide-react";

export const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Marketplace", href: "/dashboard/marketplace" },
] as const;

export const DASHBOARD_NAV_LINKS: {
  label: string;
  href: string;
  icon: LucideIcon;
}[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "New Goal", href: "/dashboard/new-goal", icon: Plus },
  { label: "Security Scan", href: "/dashboard/security-scan", icon: ShieldCheck },
  { label: "Workflows", href: "/dashboard/workflows", icon: Workflow },
  { label: "Marketplace", href: "/dashboard/marketplace", icon: Store },
  { label: "Agents", href: "/dashboard/agents", icon: Users },
  { label: "Tasks", href: "/dashboard/tasks", icon: ListChecks },
  { label: "History", href: "/dashboard/history", icon: History },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export type ExecutionStageKey =
  | "planning"
  | "matching"
  | "negotiating"
  | "assigning"
  | "monitoring"
  | "verifying"
  | "settling"
  | "completed";

/** Canonical autonomous-execution status feed, in order. Used by the
 * Create Goal flow and the Workflow page to narrate real pipeline stages. */
export const EXECUTION_STAGES: { key: ExecutionStageKey; label: string }[] = [
  { key: "planning", label: "Planning objective..." },
  { key: "matching", label: "Finding agents..." },
  { key: "negotiating", label: "Negotiating terms..." },
  { key: "assigning", label: "Assigning tasks..." },
  { key: "monitoring", label: "Monitoring execution..." },
  { key: "verifying", label: "Verifying deliverables..." },
  { key: "settling", label: "Settling escrow..." },
  { key: "completed", label: "Completed." },
];

export const SAMPLE_WORKFLOW_STAGES = [
  "Research",
  "Design",
  "Smart Contract",
  "Audit",
  "Marketing",
  "Deploy",
] as const;

export const AGENT_SPECIALIZATIONS = [
  "Research",
  "Product Design",
  "Smart Contracts",
  "Security Audit",
  "Growth Marketing",
  "DevOps & Deployment",
  "Legal & Compliance",
  "Content & Copy",
  "Data Analysis",
  "Community Management",
] as const;

export const CORE_FEATURES: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: Brain,
    title: "Goal Interpreter",
    description:
      "Feed VYRON a single objective. It decomposes the goal into a dependency-ordered workflow of executable tasks — automatically.",
  },
  {
    icon: Radar,
    title: "AI Agent Matching",
    description:
      "Every task is scored against the marketplace on price, quality, track record, and availability to find the optimal Agent Service Provider.",
  },
  {
    icon: Workflow,
    title: "Workflow Engine",
    description:
      "A living Kanban of your execution — Pending, Running, Review, Completed, Paid — updating in real time as agents deliver.",
  },
  {
    icon: ShieldCheck,
    title: "Escrow Simulator",
    description:
      "Funds lock on assignment and release only after delivery is verified. No agent gets paid for work that wasn't done.",
  },
  {
    icon: Layers,
    title: "Agent Marketplace",
    description:
      "Browse specialized ASPs by rating, completed jobs, price and ETA — or let VYRON pick the best one for you.",
  },
  {
    icon: Sparkles,
    title: "Preference Memory",
    description:
      "VYRON remembers your budget, stack, timezone and favorite providers, refining every future execution.",
  },
  {
    icon: Gauge,
    title: "Live Analytics",
    description:
      "Jobs completed, capital deployed, capital saved, average completion time, and your top-performing agents — always current.",
  },
  {
    icon: Coins,
    title: "X Layer Settlement",
    description:
      "Wallet-native settlement built for the OKX X Layer, architected for real on-chain escrow at production scale.",
  },
] as const;
