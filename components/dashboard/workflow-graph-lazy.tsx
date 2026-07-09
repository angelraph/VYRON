import dynamic from "next/dynamic";
import type { Agent, WorkflowTask } from "@/lib/types";

/** Code-split wrapper around the framer-motion-driven graph — the goal
 * detail page's initial JS payload shouldn't pay for the layout/animation
 * bundle before it's actually needed on screen. */
const WorkflowGraph = dynamic(() =>
  import("@/components/dashboard/workflow-graph").then((m) => m.WorkflowGraph),
{
  loading: () => (
    <div className="h-72 animate-pulse rounded-2xl bg-muted/40" />
  ),
});

export function WorkflowGraphLazy(props: {
  tasks: WorkflowTask[];
  agentsById: Map<string, Agent>;
}) {
  return <WorkflowGraph {...props} />;
}
