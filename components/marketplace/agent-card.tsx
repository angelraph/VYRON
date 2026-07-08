import Link from "next/link";
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import type { Agent } from "@/lib/types";

const AVAILABILITY_STYLE: Record<Agent["availability"], string> = {
  available: "bg-emerald-500/15 text-emerald-400",
  busy: "bg-amber-500/15 text-amber-400",
  offline: "bg-muted text-muted-foreground",
};

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/dashboard/marketplace/${agent.id}`}>
      <Card className="glass h-full gap-3 border-0 py-5 transition-transform hover:-translate-y-0.5">
        <CardContent className="flex h-full flex-col gap-3 px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-10 border border-border">
                <AvatarFallback className="bg-gradient-brand text-primary-foreground">
                  {agent.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium leading-snug">{agent.name}</p>
                <p className="text-muted-foreground text-xs">{agent.tagline}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {agent.specializations.map((spec) => (
              <Badge key={spec} variant="outline" className="text-[11px]">
                {spec}
              </Badge>
            ))}
          </div>

          <div className="mt-auto flex items-center justify-between pt-2 text-sm">
            <div className="flex items-center gap-1">
              <Star className="size-3.5 fill-current text-amber-400" />
              <span className="font-medium">{agent.rating.toFixed(1)}</span>
              <span className="text-muted-foreground text-xs">
                ({agent.completedJobs})
              </span>
            </div>
            <span className="font-medium">{formatCurrency(agent.pricePerTask)}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span
              className={`rounded-full px-2 py-0.5 ${AVAILABILITY_STYLE[agent.availability]}`}
            >
              {agent.availability}
            </span>
            <span className="text-muted-foreground">{agent.etaHours}h ETA</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
