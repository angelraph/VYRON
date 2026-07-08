import { TaskCard } from "@/components/dashboard/task-card";
import { WORKFLOW_TASK_STATUS_LABEL } from "@/lib/format";
import type { Agent, WorkflowTask, WorkflowTaskStatus } from "@/lib/types";

const COLUMNS: WorkflowTaskStatus[] = [
  "pending",
  "running",
  "review",
  "completed",
  "paid",
];

export function KanbanBoard({
  tasks,
  agentsById,
}: {
  tasks: WorkflowTask[];
  agentsById: Map<string, Agent>;
}) {
  return (
    <div className="scrollbar-thin -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {COLUMNS.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return (
          <div
            key={status}
            className="w-72 shrink-0 snap-start sm:w-auto sm:flex-1"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-sm font-medium">
                {WORKFLOW_TASK_STATUS_LABEL[status]}
              </p>
              <span className="text-muted-foreground text-xs">
                {columnTasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {columnTasks.length === 0 ? (
                <div className="border-border/60 text-muted-foreground/70 rounded-xl border border-dashed px-3 py-6 text-center text-xs">
                  Nothing here
                </div>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    agent={task.agentId ? (agentsById.get(task.agentId) ?? null) : null}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
