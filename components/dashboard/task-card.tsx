import Link from "next/link";
import { Clock, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/format";
import type { Agent, WorkflowTask } from "@/lib/types";

export function TaskCard({
  task,
  agent,
}: {
  task: WorkflowTask;
  agent: Agent | null;
}) {
  return (
    <Card className="glass gap-2 border-0 py-4">
      <CardContent className="flex flex-col gap-3 px-4">
        <div>
          <p className="text-sm font-medium leading-snug">{task.title}</p>
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
            {task.description}
          </p>
        </div>
        <div className="flex items-center justify-between">
          {agent ? (
            <Link
              href={`/dashboard/marketplace/${agent.id}`}
              className="flex items-center gap-2"
            >
              <Avatar className="size-6 border border-border">
                <AvatarFallback className="bg-gradient-brand text-primary-foreground text-[10px]">
                  {agent.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground text-xs">
                {agent.name}
              </span>
            </Link>
          ) : (
            <span className="text-muted-foreground text-xs">Unassigned</span>
          )}
          <span className="text-xs font-medium">
            {formatCurrency(task.price)}
          </span>
        </div>
        <div className="text-muted-foreground flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {task.etaHours}h ETA
          </span>
          {task.trustScore !== null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-default items-center gap-1 text-emerald-400">
                  <ShieldCheck className="size-3" />
                  Trust {task.trustScore}/100
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {task.matchRationale ?? "No rationale recorded."}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
