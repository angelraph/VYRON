"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function AssignAgentButton({ agentName }: { agentName: string }) {
  return (
    <Button
      className="bg-gradient-brand text-primary-foreground"
      onClick={() =>
        toast(`${agentName} will be assigned automatically`, {
          description:
            "Manual assignment lands with the VYRON Execution Engine — for now, matching happens per-task from your workflow.",
        })
      }
    >
      Assign to a task
    </Button>
  );
}
