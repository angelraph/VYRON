import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GOAL_STATUS_LABEL, formatCurrency } from "@/lib/format";
import type { Goal, WorkflowTask } from "@/lib/types";

const STATUS_VARIANT: Record<Goal["status"], "secondary" | "default" | "outline"> = {
  planning: "outline",
  in_progress: "default",
  completed: "secondary",
};

export function GoalCard({ goal, tasks }: { goal: Goal; tasks: WorkflowTask[] }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "completed" || t.status === "paid").length;
  const progress = total ? Math.round((done / total) * 100) : 0;

  return (
    <Link href={`/dashboard/workflows/${goal.id}`}>
      <Card className="glass gap-3 border-0 py-5 transition-transform hover:-translate-y-0.5">
        <CardContent className="flex flex-col gap-3 px-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-medium leading-snug">{goal.title}</h3>
            <Badge variant={STATUS_VARIANT[goal.status]} className="shrink-0">
              {GOAL_STATUS_LABEL[goal.status]}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {done}/{total} tasks complete
            </span>
            <span>{formatCurrency(goal.budget)} budget</span>
          </div>
          <Progress value={progress} />
        </CardContent>
      </Card>
    </Link>
  );
}
