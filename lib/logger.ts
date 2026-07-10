/** Structured logging: one JSON line per event to stdout/stderr. No new
 * dependency — this is the minimum viable shape any log aggregator
 * (Vercel logs, Docker + ELK, Datadog log drains, etc.) can parse without
 * extra configuration. Swap the `emit` body for a real logging SDK later
 * without touching any call site. */
export interface LogFields {
  goalId?: string;
  taskId?: string;
  agentId?: string | null;
  /** Pipeline stage this event belongs to, e.g. "execution", "verification",
   * "intent_analysis", "monitor_tick". */
  stage?: string;
  durationMs?: number;
  model?: string;
  outcome?: "success" | "failure" | "approved" | "rejected" | "fallback" | "skipped";
  [key: string]: unknown;
}

function emit(level: "info" | "warn" | "error", event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
