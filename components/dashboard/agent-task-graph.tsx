"use client";

import { motion } from "framer-motion";
import { Workflow } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/empty-state";
import type { VeeAgentAssignment } from "@/lib/execution-engine";

/** Renders the real per-agent breakdown the execution engine produced —
 * whichever real marketplace agents actually matched this goal's real
 * decomposed tasks. Not a fixed set of lanes: a different goal can (and
 * will) surface a different subset of the marketplace. */
export function AgentTaskGraph({
  assignments,
}: {
  assignments: VeeAgentAssignment[];
}) {
  if (assignments.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title="No agents assigned"
        description="VYRON couldn't find a compatible agent for any task in this goal."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {assignments.map(({ agent, tasks }, agentIndex) => (
        <motion.div
          key={agent.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: agentIndex * 0.1 }}
        >
          <Card className="glass h-full border-0 py-5">
            <CardContent className="flex h-full flex-col gap-4 px-5">
              <div className="flex items-center gap-3">
                <Avatar className="border-border size-10 border">
                  <AvatarFallback className="bg-gradient-brand text-primary-foreground">
                    {agent.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{agent.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {agent.tagline}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {tasks.map((task, taskIndex) => (
                  <motion.div
                    key={task.title}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: agentIndex * 0.1 + 0.15 + taskIndex * 0.05,
                    }}
                    className="border-border/60 flex items-start justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <p className="text-xs">{task.title}</p>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {task.specialization}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
