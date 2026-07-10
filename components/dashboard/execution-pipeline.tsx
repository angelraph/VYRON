"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  CheckCircle2,
  Loader2,
  Rocket,
  Target,
  Users,
  Workflow,
  XCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { VeeEvent, VeeStage } from "@/lib/execution-engine";

/** A real pipeline event, timestamped at the moment the client actually
 * received it — not fabricated, not evenly spaced, just when the SSE line
 * genuinely arrived. */
export interface TimedVeeEvent {
  event: VeeEvent;
  receivedAt: number;
}

type UiStageKey =
  | "goal_received"
  | "goal_interpretation"
  | "task_decomposition"
  | "agent_assignment"
  | "execution_started";

type UiStatus = "pending" | "active" | "complete" | "error";

const UI_STAGES: { key: UiStageKey; label: string; icon: typeof Target }[] = [
  { key: "goal_received", label: "Goal Received", icon: Target },
  { key: "goal_interpretation", label: "Goal Interpretation", icon: Brain },
  { key: "task_decomposition", label: "Task Decomposition", icon: Workflow },
  { key: "agent_assignment", label: "Agent Assignment", icon: Users },
  { key: "execution_started", label: "Execution Started", icon: Rocket },
];

/** Maps the execution engine's real backend stages onto the 5 stages this
 * dashboard shows. `verification`/`escrow_settlement` belong to a task's
 * later lifecycle (the autonomous monitor), not goal creation, so they
 * never appear here. */
const BACKEND_TO_UI: Record<VeeStage, UiStageKey | null> = {
  goal_submitted: "goal_received",
  memory_update: "goal_received",
  intent_analysis: "goal_interpretation",
  task_planning: "task_decomposition",
  dependency_graph: "task_decomposition",
  marketplace_search: "agent_assignment",
  trust_scoring: "agent_assignment",
  agent_assignment: "agent_assignment",
  execution_monitoring: "execution_started",
  verification: null,
  escrow_settlement: null,
  error: null,
};

function formatClockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const STATUS_ICON_CLASS: Record<UiStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  active: "bg-gradient-brand text-primary-foreground",
  complete: "bg-emerald-400/15 text-emerald-400",
  error: "bg-destructive/15 text-destructive",
};

export function ExecutionPipeline({
  timeline,
  streaming,
  errored,
}: {
  timeline: TimedVeeEvent[];
  streaming: boolean;
  errored: boolean;
}) {
  const byUiStage = new Map<UiStageKey, TimedVeeEvent[]>();
  for (const entry of timeline) {
    const uiKey = BACKEND_TO_UI[entry.event.stage];
    if (!uiKey) continue;
    if (!byUiStage.has(uiKey)) byUiStage.set(uiKey, []);
    byUiStage.get(uiKey)!.push(entry);
  }

  const activeIndex = UI_STAGES.reduce(
    (lastSeen, stage, i) => (byUiStage.has(stage.key) ? i : lastSeen),
    -1,
  );

  return (
    <div className="flex flex-col gap-3">
      {UI_STAGES.map((stage, i) => {
        const entries = byUiStage.get(stage.key) ?? [];
        const hasStarted = entries.length > 0;
        const isCurrent = i === activeIndex;

        let status: UiStatus = "pending";
        if (hasStarted) {
          if (isCurrent && errored) status = "error";
          else if (isCurrent && streaming) status = "active";
          else status = "complete";
        }

        const firstEntry = entries[0];
        const lastEntry = entries[entries.length - 1];

        let progressPct = 0;
        if (status === "complete") {
          progressPct = 100;
        } else if (status === "active" || status === "error") {
          const withProgress = [...entries]
            .reverse()
            .find((e) => e.event.progress)?.event.progress;
          progressPct = withProgress
            ? Math.round((withProgress.current / withProgress.total) * 100)
            : 45; // genuinely in flight, just no finer-grained sub-count for this stage
        }

        const Icon = stage.icon;
        const StatusIcon =
          status === "active"
            ? Loader2
            : status === "complete"
              ? CheckCircle2
              : status === "error"
                ? XCircle
                : Icon;

        return (
          <motion.div
            key={stage.key}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: hasStarted || status === "pending" ? 1 : 0.4, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.08, ease: "easeOut" }}
            className={`glass rounded-xl border-0 p-4 transition-shadow ${
              status === "error" ? "ring-destructive/50 ring-1" : ""
            } ${status === "active" ? "ring-violet/40 ring-1" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={status}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${STATUS_ICON_CLASS[status]}`}
                  >
                    <StatusIcon
                      className={`size-4 ${status === "active" ? "animate-spin" : ""}`}
                    />
                  </motion.div>
                </AnimatePresence>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{stage.label}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {firstEntry?.event.message ?? "Waiting for prior stages..."}
                  </p>
                  {lastEntry && lastEntry !== firstEntry && (
                    <p className="text-muted-foreground/80 truncate text-xs italic">
                      {lastEntry.event.message}
                    </p>
                  )}
                </div>
              </div>
              {firstEntry && (
                <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                  {formatClockTime(firstEntry.receivedAt)}
                </span>
              )}
            </div>
            {hasStarted && <Progress value={progressPct} className="mt-3 h-1" />}
          </motion.div>
        );
      })}
    </div>
  );
}
