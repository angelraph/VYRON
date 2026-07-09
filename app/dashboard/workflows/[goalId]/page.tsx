import { notFound } from "next/navigation";
import { Radar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import { WorkflowGraphLazy } from "@/components/dashboard/workflow-graph-lazy";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { getAgents, getGoalById, getWorkflowTasksByGoal } from "@/lib/db";
import { GOAL_STATUS_LABEL, formatCurrency } from "@/lib/format";
import { describeGoalProgress } from "@/lib/view-models";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ goalId: string }>;
}) {
  const { goalId } = await params;

  const [goal, tasks, agents] = await Promise.all([
    getGoalById(goalId),
    getWorkflowTasksByGoal(goalId),
    getAgents(),
  ]);
  if (!goal) notFound();

  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

  return (
    <div>
      <LiveRefresh active={goal.status !== "completed"} />
      <PageHeader
        title={goal.title}
        description={`${formatCurrency(goal.budget)} budget · ${tasks.length} tasks`}
        action={<Badge>{GOAL_STATUS_LABEL[goal.status]}</Badge>}
      />
      <div className="glass mb-5 flex items-start gap-3 rounded-xl border-0 px-4 py-3">
        <Radar className="text-violet mt-0.5 size-4 shrink-0 animate-pulse" />
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            VYRON right now
          </p>
          <p className="mt-0.5 text-sm">{describeGoalProgress(tasks)}</p>
        </div>
      </div>
      <Tabs defaultValue="graph">
        <TabsList className="mb-5">
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
        </TabsList>
        <TabsContent value="graph">
          <WorkflowGraphLazy tasks={tasks} agentsById={agentsById} />
        </TabsContent>
        <TabsContent value="board">
          <KanbanBoard tasks={tasks} agentsById={agentsById} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
