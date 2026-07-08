import { notFound } from "next/navigation";
import { Briefcase, Clock, Star } from "lucide-react";
import { getAgentById } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { AssignAgentButton } from "@/components/marketplace/assign-agent-button";
import { AgentUnavailabilityButton } from "@/components/marketplace/agent-unavailability-button";

const AVAILABILITY_STYLE: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-400",
  busy: "bg-amber-500/15 text-amber-400",
  offline: "bg-muted text-muted-foreground",
};

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const agent = await getAgentById(agentId);
  if (!agent) notFound();

  return (
    <div>
      <PageHeader title="Agent profile" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="glass border-0 py-6 lg:col-span-2">
          <CardContent className="flex flex-col gap-5 px-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Avatar className="size-16 border border-border">
                <AvatarFallback className="bg-gradient-brand text-primary-foreground text-lg">
                  {agent.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {agent.name}
                </h2>
                <p className="text-muted-foreground text-sm">{agent.tagline}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {agent.specializations.map((spec) => (
                    <Badge key={spec} variant="outline">
                      {spec}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed">
              {agent.bio}
            </p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Star className="size-3.5 fill-current text-amber-400" />
                  Rating
                </p>
                <p className="mt-1 font-medium">{agent.rating.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Briefcase className="size-3.5" />
                  Completed
                </p>
                <p className="mt-1 font-medium">{agent.completedJobs}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Clock className="size-3.5" />
                  ETA
                </p>
                <p className="mt-1 font-medium">{agent.etaHours}h</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Price / task</p>
                <p className="mt-1 font-medium">
                  {formatCurrency(agent.pricePerTask)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-0 py-6">
          <CardContent className="flex flex-col gap-4 px-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Availability</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${AVAILABILITY_STYLE[agent.availability]}`}
              >
                {agent.availability}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Member since</span>
              <span>
                {new Date(agent.joinedAt).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <AssignAgentButton agentName={agent.name} />
            <AgentUnavailabilityButton
              agentId={agent.id}
              agentName={agent.name}
              availability={agent.availability}
            />
            <Button variant="outline" asChild>
              <a href="mailto:agents@vyron.dev">Contact support</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
