import {
  Banknote,
  CheckCircle2,
  Flag,
  History,
  Lock,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Undo2,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { formatRelativeTime } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";

const ICONS: Record<ActivityEvent["type"], typeof Target> = {
  goal_created: Target,
  goal_completed: Flag,
  agent_matched: Sparkles,
  agent_reassigned: RefreshCw,
  task_started: Play,
  task_delivered: CheckCircle2,
  task_verified: ShieldCheck,
  escrow_locked: Lock,
  escrow_released: Banknote,
  escrow_refunded: Undo2,
};

function groupByDay(events: ActivityEvent[]) {
  const groups = new Map<string, ActivityEvent[]>();
  for (const event of events) {
    const key = new Date(event.createdAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }
  return groups;
}

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Every match, delivery, and settlement VYRON makes will show up here."
      />
    );
  }

  const groups = groupByDay(events);

  return (
    <div className="flex flex-col gap-8">
      {[...groups.entries()].map(([day, dayEvents]) => (
        <div key={day}>
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
            {day}
          </p>
          <div className="relative flex flex-col gap-5 pl-6">
            <div className="bg-border absolute top-1 bottom-1 left-[9px] w-px" />
            {dayEvents.map((event) => {
              const Icon = ICONS[event.type];
              return (
                <div key={event.id} className="relative">
                  <div className="bg-background border-violet/50 absolute top-0.5 -left-6 flex size-[18px] items-center justify-center rounded-full border">
                    <Icon className="text-violet size-2.5" />
                  </div>
                  <p className="text-sm leading-snug">{event.message}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatRelativeTime(event.createdAt)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
