import type { WorkflowTask } from "@/lib/types";

export interface GraphLayout {
  /** Tasks grouped by dependency depth — column 0 has no dependencies. */
  columns: WorkflowTask[][];
  levelOf: Map<string, number>;
}

/** Computes each task's dependency depth (longest path from a root task)
 * and groups tasks into columns by that depth, so parallel branches render
 * side by side instead of a flat list. */
export function buildGraphLayout(tasks: WorkflowTask[]): GraphLayout {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const levelOf = new Map<string, number>();

  function levelFor(task: WorkflowTask, guard: Set<string>): number {
    const cached = levelOf.get(task.id);
    if (cached !== undefined) return cached;
    if (guard.has(task.id)) return 0;
    guard.add(task.id);

    if (task.dependsOn.length === 0) {
      levelOf.set(task.id, 0);
      return 0;
    }

    const depLevels = task.dependsOn
      .map((depId) => byId.get(depId))
      .filter((dep): dep is WorkflowTask => Boolean(dep))
      .map((dep) => levelFor(dep, guard));

    const level = depLevels.length ? Math.max(...depLevels) + 1 : 0;
    levelOf.set(task.id, level);
    return level;
  }

  for (const task of tasks) levelFor(task, new Set());

  const maxLevel = tasks.length
    ? Math.max(...[...levelOf.values()])
    : 0;
  const columns: WorkflowTask[][] = Array.from(
    { length: maxLevel + 1 },
    () => [],
  );
  for (const task of tasks) {
    columns[levelOf.get(task.id) ?? 0].push(task);
  }
  for (const column of columns) {
    column.sort((a, b) => a.order - b.order);
  }

  return { columns, levelOf };
}
