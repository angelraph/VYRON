"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Terminal } from "lucide-react";
import type { VeeEvent } from "@/lib/execution-engine";

const STAGE_DOT: Record<VeeEvent["stage"], string> = {
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

  return (
    <div className="glass-strong scrollbar-thin flex h-full max-h-[26rem] min-h-[20rem] flex-col overflow-y-auto rounded-2xl p-5 font-mono text-sm">
      <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs tracking-wide uppercase">
        <Terminal className="size-3.5" />
        VYRON Execution Console
      </div>
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
            <span className={event.stage === "error" ? "text-destructive" : ""}>
              {event.message}
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
