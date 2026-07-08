import { getCurrentUser } from "@/lib/auth";
import { getAgents, getGoals, getWorkflowTasksByGoal } from "@/lib/db";
import { buildTaskRows } from "@/lib/view-models";
import { PageHeader } from "@/components/dashboard/page-header";
import { TasksList } from "@/components/dashboard/tasks-list";

export default async function TasksPage() {
  const user = await getCurrentUser();
  const [goals, agents] = await Promise.all([getGoals(user.id), getAgents()]);
  const tasksByGoal = await Promise.all(
    goals.map((goal) => getWorkflowTasksByGoal(goal.id)),
  );
  const rows = buildTaskRows(goals, tasksByGoal, agents);

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Every task across every goal, in one flat view."
      />
      <TasksList rows={rows} />
    </div>
  );
}
