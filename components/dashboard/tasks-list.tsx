"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, ListChecks, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/dashboard/empty-state";
import { WORKFLOW_TASK_STATUS_LABEL, formatCurrency } from "@/lib/format";
import type { TaskRow } from "@/lib/view-models";
import type { WorkflowTaskStatus } from "@/lib/types";

const TABS: (WorkflowTaskStatus | "all")[] = [
  "all",
  "pending",
  "running",
  "review",
  "completed",
  "paid",
];

export function TasksList({ rows }: { rows: TaskRow[] }) {
  const [tab, setTab] = useState<WorkflowTaskStatus | "all">("all");

  const filtered = useMemo(
    () => (tab === "all" ? rows : rows.filter((row) => row.task.status === tab)),
    [rows, tab],
  );

  return (
    <div>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as WorkflowTaskStatus | "all")}
        className="mb-5"
      >
        <TabsList className="scrollbar-thin w-full justify-start overflow-x-auto">
          {TABS.map((value) => (
            <TabsTrigger key={value} value={value} className="capitalize">
              {value === "all" ? "All" : WORKFLOW_TASK_STATUS_LABEL[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks here"
          description="Tasks will appear here as VYRON breaks goals into executable work."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(({ task, goal, agent }) => (
            <Link
              key={task.id}
              href={`/dashboard/workflows/${goal.id}`}
              className="glass flex flex-col gap-2 rounded-xl px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {goal.title}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
                {agent && (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="size-5 border border-border">
                      <AvatarFallback className="bg-gradient-brand text-primary-foreground text-[9px]">
                        {agent.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground text-xs">
                      {agent.name}
                    </span>
                  </div>
                )}
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Clock className="size-3" />
                  {task.etaHours}h
                </span>
                <span className="text-xs font-medium">
                  {formatCurrency(task.price)}
                </span>
                {task.trustScore !== null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex cursor-default items-center gap-1 text-xs text-emerald-400">
                        <ShieldCheck className="size-3" />
                        {task.trustScore}/100
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {task.matchRationale ?? "No rationale recorded."}
                    </TooltipContent>
                  </Tooltip>
                )}
                <Badge variant="outline" className="text-[11px]">
                  {WORKFLOW_TASK_STATUS_LABEL[task.status]}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
