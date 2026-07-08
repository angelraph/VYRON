import { getCurrentUser } from "@/lib/auth";
import { getActivityEvents, getGoals } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { Card, CardContent } from "@/components/ui/card";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  const [events, goals] = await Promise.all([
    getActivityEvents(user.id, 100),
    getGoals(user.id),
  ]);
  const hasActiveGoal = goals.some((goal) => goal.status !== "completed");

  return (
    <div>
      <LiveRefresh active={hasActiveGoal} />
      <PageHeader
        title="History"
        description="A complete timeline of everything VYRON has done."
      />
      <Card className="glass border-0 py-6">
        <CardContent className="px-6">
          <ActivityTimeline events={events} />
        </CardContent>
      </Card>
    </div>
  );
}
