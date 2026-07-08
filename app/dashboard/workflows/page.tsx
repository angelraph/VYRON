import Link from "next/link";
import { Plus, Workflow as WorkflowIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getGoals, getWorkflowTasksByGoal } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { GoalCard } from "@/components/dashboard/goal-card";
import { EmptyState } from "@/components/dashboard/empty-state";

export default async function WorkflowsPage() {
  const user = await getCurrentUser();
  const goals = await getGoals(user.id);
  const tasksByGoal = await Promise.all(
    goals.map((goal) => getWorkflowTasksByGoal(goal.id)),
  );

  return (
    <div>
      <PageHeader
        title="Workflows"
        description="Every goal VYRON is executing, and how far each one has come."
        action={
          <Button asChild className="bg-gradient-brand text-primary-foreground">
            <Link href="/dashboard/new-goal">
              <Plus className="size-4" />
              New goal
            </Link>
          </Button>
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title="No workflows yet"
          description="Create a goal and VYRON will lay out its execution plan here."
          action={
            <Button asChild size="sm">
              <Link href="/dashboard/new-goal">Create a goal</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal, i) => (
            <GoalCard key={goal.id} goal={goal} tasks={tasksByGoal[i]} />
          ))}
        </div>
      )}
    </div>
  );
}
