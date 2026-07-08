import Link from "next/link";
import { Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getAgents, getGoals, getWorkflowTasksByGoal } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/page-header";
import { AgentCard } from "@/components/marketplace/agent-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";

export default async function MyAgentsPage() {
  const user = await getCurrentUser();
  const [goals, agents] = await Promise.all([getGoals(user.id), getAgents()]);
  const tasksByGoal = await Promise.all(
    goals.map((goal) => getWorkflowTasksByGoal(goal.id)),
  );

  const hiredAgentIds = new Set(
    tasksByGoal.flat().flatMap((task) => (task.agentId ? [task.agentId] : [])),
  );
  const hiredAgents = agents.filter((agent) => hiredAgentIds.has(agent.id));

  return (
    <div>
      <PageHeader
        title="Your agents"
        description="Every ASP VYRON has hired on your behalf so far."
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard/marketplace">Browse marketplace</Link>
          </Button>
        }
      />

      {hiredAgents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No agents hired yet"
          description="Once VYRON matches agents to your workflow tasks, they'll show up here."
          action={
            <Button asChild size="sm">
              <Link href="/dashboard/marketplace">Browse marketplace</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hiredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
