import Link from "next/link";
import { CheckCircle2, Clock, Plus, Target, TrendingUp, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getActivityEvents,
  getAgents,
  getEscrowTransactionsForTasks,
  getGoals,
  getWorkflowTasksByGoal,
} from "@/lib/db";
import { computeDashboardStats } from "@/lib/view-models";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { GoalCard } from "@/components/dashboard/goal-card";
import { ActivityItem } from "@/components/dashboard/activity-item";
import { EmptyState } from "@/components/dashboard/empty-state";
import { LiveRefresh } from "@/components/shared/live-refresh";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [goals, agents, activity] = await Promise.all([
    getGoals(user.id),
    getAgents(),
    getActivityEvents(user.id, 6),
  ]);
  const goalTasks = await Promise.all(
    goals.map((goal) => getWorkflowTasksByGoal(goal.id)),
  );
  const escrowTxs = await getEscrowTransactionsForTasks(goalTasks.flat());
  const stats = computeDashboardStats(goals, goalTasks, escrowTxs, agents);

  return (
    <div>
      <LiveRefresh active={stats.activeGoalsCount > 0} />
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="Here's what VYRON has been executing on your behalf."
        action={
          <Button asChild className="bg-gradient-brand text-primary-foreground">
            <Link href="/dashboard/new-goal">
              <Plus className="size-4" />
              New goal
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active goals"
          value={String(stats.activeGoalsCount)}
          icon={Target}
        />
        <StatCard
          label="Jobs completed"
          value={String(stats.jobsCompleted)}
          icon={CheckCircle2}
        />
        <StatCard
          label="Total spent"
          value={formatCurrency(stats.totalSpent)}
          icon={Wallet}
        />
        <StatCard
          label="Total saved"
          value={formatCurrency(stats.totalSaved)}
          icon={TrendingUp}
          hint="vs. list-price matching"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Active goals</h2>
            <Link
              href="/dashboard/workflows"
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              View all
            </Link>
          </div>
          {goals.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No goals yet"
              description="Give VYRON one high-level objective and it will plan, staff, and execute the rest."
              action={
                <Button asChild size="sm">
                  <Link href="/dashboard/new-goal">Create your first goal</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {goals.map((goal, i) => (
                <GoalCard key={goal.id} goal={goal} tasks={goalTasks[i]} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card className="glass gap-3 border-0 py-5">
            <CardHeader className="px-5">
              <CardTitle className="text-sm font-medium">Top agent</CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              {stats.topAgent ? (
                <Link
                  href={`/dashboard/marketplace/${stats.topAgent.id}`}
                  className="flex items-center gap-3"
                >
                  <Avatar className="size-10 border border-border">
                    <AvatarFallback className="bg-gradient-brand text-primary-foreground">
                      {stats.topAgent.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{stats.topAgent.name}</p>
                    <p className="text-muted-foreground text-xs">
                      Most tasks assigned
                    </p>
                  </div>
                </Link>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Assign your first task to see a top agent here.
                </p>
              )}
              <div className="text-muted-foreground mt-4 flex items-center gap-1.5 text-xs">
                <Clock className="size-3.5" />
                Avg completion: {stats.avgCompletionHours || "—"}h
              </div>
            </CardContent>
          </Card>

          <Card className="glass gap-3 border-0 py-5">
            <CardHeader className="flex-row items-center justify-between px-5">
              <CardTitle className="text-sm font-medium">
                Recent activity
              </CardTitle>
              <Link
                href="/dashboard/history"
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent className="divide-border divide-y px-5">
              {activity.length === 0 ? (
                <p className="text-muted-foreground py-2 text-sm">
                  No activity yet.
                </p>
              ) : (
                activity.map((event) => (
                  <ActivityItem key={event.id} event={event} />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
