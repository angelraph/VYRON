import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import { WorkflowGraph } from "@/components/dashboard/workflow-graph";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { getAgents, getGoalById, getWorkflowTasksByGoal } from "@/lib/db";
import { GOAL_STATUS_LABEL, formatCurrency } from "@/lib/format";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ goalId: string }>;
}) {
  const { goalId } = await params;
  const goal = await getGoalById(goalId);
  if (!goal) notFound();

  const [tasks, agents] = await Promise.all([
    getWorkflowTasksByGoal(goalId),
    getAgents(),
  ]);
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

  return (
    <div>
      <LiveRefresh active={goal.status !== "completed"} />
      <PageHeader
        title={goal.title}
        description={`${formatCurrency(goal.budget)} budget · ${tasks.length} tasks`}
        action={<Badge>{GOAL_STATUS_LABEL[goal.status]}</Badge>}
      />
      <Tabs defaultValue="graph">
        <TabsList className="mb-5">
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
        </TabsList>
        <TabsContent value="graph">
          <WorkflowGraph tasks={tasks} agentsById={agentsById} />
        </TabsContent>
        <TabsContent value="board">
          <KanbanBoard tasks={tasks} agentsById={agentsById} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
