"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Terminal } from "lucide-react";
import type { VeeEvent, VeeStage } from "@/lib/execution-engine";

const STAGE_DOT: Record<VeeStage, string> = {
  goal_submitted: "bg-violet",
  intent_analysis: "bg-violet",
  task_planning: "bg-violet",
  dependency_graph: "bg-cyan",
  marketplace_search: "bg-cyan",
  trust_scoring: "bg-cyan",
  agent_assignment: "bg-emerald-400",
  execution_monitoring: "bg-emerald-400",
  verification: "bg-emerald-400",
  escrow_settlement: "bg-amber-400",
  memory_update: "bg-amber-400",
  error: "bg-destructive",
};

/** Human-readable name for each VEE pipeline stage — shown as a small tag
 * next to every log line so the console reads as a narrated plan, not a
 * raw event feed. */
const STAGE_LABEL: Record<VeeStage, string> = {
  goal_submitted: "Goal Received",
  intent_analysis: "Intent Analysis",
  task_planning: "Task Planning",
  dependency_graph: "Dependency Graph",
  marketplace_search: "Marketplace Search",
  trust_scoring: "Trust Scoring",
  agent_assignment: "Agent Assignment",
  execution_monitoring: "Execution Start",
  verification: "Verification",
  escrow_settlement: "Escrow Settlement",
  memory_update: "Memory Recall",
  error: "Error",
};

/** The pipeline's real stage count (excludes `error`, which isn't a planned
 * step) — used to show "step X of N" progress while narrating. */
const TOTAL_STAGES = Object.keys(STAGE_LABEL).length - 1;

export function ExecutionConsole({
  events,
  streaming,
}: {
  events: VeeEvent[];
  streaming: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events.length]);

  const lastEvent = events[events.length - 1];
  const stagesSeen = new Set(
    events.filter((e) => e.stage !== "error").map((e) => e.stage),
  ).size;

  return (
    <div className="glass-strong scrollbar-thin flex h-full max-h-[26rem] min-h-[20rem] flex-col overflow-y-auto rounded-2xl p-5 font-mono text-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-muted-foreground flex items-center gap-2 text-xs tracking-wide uppercase">
          <Terminal className="size-3.5" />
          VYRON Execution Console
        </div>
        {streaming && (
          <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
            Step {Math.min(stagesSeen, TOTAL_STAGES)}/{TOTAL_STAGES}
          </span>
        )}
      </div>
      {streaming && lastEvent && (
        <div className="border-border/60 mb-3 flex items-center gap-2 border-b pb-3 text-xs">
          <span className="bg-violet/15 text-violet rounded-full px-2 py-0.5 font-medium">
            {STAGE_LABEL[lastEvent.stage]}
          </span>
          <span className="text-muted-foreground">narrating this step...</span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {events.map((event, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-start gap-2.5"
          >
            <span
              className={`mt-1.5 size-1.5 shrink-0 rounded-full ${STAGE_DOT[event.stage]}`}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-muted-foreground/80 text-[10px] tracking-wide uppercase">
                {STAGE_LABEL[event.stage]}
              </span>
              <span className={event.stage === "error" ? "text-destructive" : ""}>
                {event.message}
              </span>
            </span>
          </motion.div>
        ))}
        {streaming && (
          <motion.span
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.1, repeat: Infinity }}
            className="bg-cyan ml-4 h-3.5 w-1.5"
          />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
