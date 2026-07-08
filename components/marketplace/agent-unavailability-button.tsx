"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ZapOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { simulateAgentUnavailableAction } from "@/lib/actions/agents";

export function AgentUnavailabilityButton({
  agentId,
  agentName,
  availability,
}: {
  agentId: string;
  agentName: string;
  availability: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const outcomes = await simulateAgentUnavailableAction(agentId);

      if (outcomes.length === 0) {
        toast.info(`${agentName} is now offline`, {
          description: "No active tasks needed reassignment.",
        });
      } else {
        const reassigned = outcomes.filter((o) => o.newAgentId);
        toast.success(`${agentName} went offline — VYRON replanned`, {
          description:
            reassigned.length > 0
              ? reassigned
                  .map((o) => `${o.taskTitle} → ${o.newAgentName} (trust ${o.trustScore}/100)`)
                  .join(" · ")
              : "No compatible replacement agent was found.",
        });
      }
      router.refresh();
    });
  }

  if (availability === "offline") {
    return (
      <Button variant="outline" disabled className="w-full">
        Already offline
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={isPending}
      className="w-full"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ZapOff className="size-4" />
      )}
      Simulate unavailability
    </Button>
  );
}
