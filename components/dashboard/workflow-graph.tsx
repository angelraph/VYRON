"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Loader2, ShieldCheck } from "lucide-react";
import { buildGraphLayout } from "@/lib/graph";
import { formatCurrency } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Agent, WorkflowTask, WorkflowTaskStatus } from "@/lib/types";

const NODE_WIDTH = 208;
const NODE_HEIGHT = 92;
const COL_GAP = 56;
const ROW_GAP = 18;

const STATUS_RING: Record<WorkflowTaskStatus, string> = {
  pending: "border-border/70",
  running: "border-violet glow-violet",
  review: "border-amber-400/70",
  completed: "border-emerald-400/70",
  paid: "border-emerald-400/70",
};

function StatusIcon({ status }: { status: WorkflowTaskStatus }) {
  if (status === "running") {
    return <Loader2 className="text-violet size-3.5 animate-spin" />;
  }
  if (status === "completed" || status === "paid") {
    return <Check className="size-3.5 text-emerald-400" />;
  }
  return <Clock className="text-muted-foreground size-3.5" />;
}

export function WorkflowGraph({
  tasks,
  agentsById,
}: {
  tasks: WorkflowTask[];
  agentsById: Map<string, Agent>;
}) {
  const { columns } = useMemo(() => buildGraphLayout(tasks), [tasks]);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const maxRows = Math.max(1, ...columns.map((col) => col.length));
    const maxColHeight = maxRows * NODE_HEIGHT + (maxRows - 1) * ROW_GAP;

    columns.forEach((column, colIndex) => {
      const colHeight = column.length * NODE_HEIGHT + (column.length - 1) * ROW_GAP;
      const offsetY = (maxColHeight - colHeight) / 2;
      column.forEach((task, rowIndex) => {
        map.set(task.id, {
          x: colIndex * (NODE_WIDTH + COL_GAP),
          y: offsetY + rowIndex * (NODE_HEIGHT + ROW_GAP),
        });
      });
    });

    return { map, width: columns.length * (NODE_WIDTH + COL_GAP) - COL_GAP, height: maxColHeight };
  }, [columns]);

  const edges = useMemo(() => {
    return tasks.flatMap((task) =>
      task.dependsOn.flatMap((depId) => {
        const from = positions.map.get(depId);
        const to = positions.map.get(task.id);
        if (!from || !to) return [];
        const x1 = from.x + NODE_WIDTH;
        const y1 = from.y + NODE_HEIGHT / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_HEIGHT / 2;
        const midX = (x1 + x2) / 2;
        return [
          {
            key: `${depId}->${task.id}`,
            d: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
            active: task.status !== "pending",
          },
        ];
      }),
    );
  }, [tasks, positions]);

  if (tasks.length === 0) return null;

  return (
    <div className="scrollbar-thin overflow-x-auto pb-4">
      <div
        className="relative"
        style={{ width: positions.width, height: positions.height }}
      >
        <svg
          className="pointer-events-none absolute inset-0"
          width={positions.width}
          height={positions.height}
        >
          {edges.map((edge, i) => (
            <motion.path
              key={edge.key}
              d={edge.d}
              fill="none"
              stroke={edge.active ? "var(--cyan)" : "var(--border)"}
              strokeWidth={1.5}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.06 }}
            />
          ))}
        </svg>

        {tasks.map((task) => {
          const pos = positions.map.get(task.id);
          if (!pos) return null;
          const agent = task.agentId ? agentsById.get(task.agentId) : undefined;
          const level = columns.findIndex((col) => col.includes(task));

          const node = (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: level * 0.1 }}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
              }}
              className={`glass flex flex-col justify-between rounded-xl border-2 p-3 ${STATUS_RING[task.status]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs leading-snug font-medium">{task.title}</p>
                <StatusIcon status={task.status} />
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                <span className="truncate">{agent?.name ?? "Unassigned"}</span>
                <span>{formatCurrency(task.price)}</span>
              </div>
              {task.trustScore !== null && (
                <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <ShieldCheck className="size-2.5" />
                  Trust {task.trustScore}/100
                </div>
              )}
            </motion.div>
          );

          if (task.trustScore === null) return node;

          return (
            <Tooltip key={task.id}>
              <TooltipTrigger asChild>{node}</TooltipTrigger>
              <TooltipContent>
                {task.matchRationale ?? "No rationale recorded."}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
