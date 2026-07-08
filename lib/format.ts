import type { GoalStatus, WorkflowTaskStatus } from "@/lib/types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.parse(iso) - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 24 * 365],
    ["month", 60 * 24 * 30],
    ["day", 60 * 24],
    ["hour", 60],
    ["minute", 1],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, minutesPerUnit] of units) {
    if (Math.abs(diffMinutes) >= minutesPerUnit || unit === "minute") {
      return rtf.format(Math.round(diffMinutes / minutesPerUnit), unit);
    }
  }
  return "just now";
}

export const WORKFLOW_TASK_STATUS_LABEL: Record<WorkflowTaskStatus, string> = {
  pending: "Pending",
  running: "Running",
  review: "Review",
  completed: "Completed",
  paid: "Paid",
};

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  planning: "Planning",
  in_progress: "In progress",
  completed: "Completed",
};
