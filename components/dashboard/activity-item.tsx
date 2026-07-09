import {
  Banknote,
  CheckCircle2,
  Flag,
  Lock,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Undo2,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { TxLink } from "@/components/dashboard/tx-link";
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

export function ActivityItem({ event }: { event: ActivityEvent }) {
  const Icon = ICONS[event.type];

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="bg-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
        <Icon className="text-violet size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{event.message}</p>
        <p className="text-muted-foreground text-xs">
          {formatRelativeTime(event.createdAt)}
        </p>
        <TxLink txHash={event.txHash} explorerUrl={event.explorerUrl} />
      </div>
    </div>
  );
}
