/** Used only to backdate seed/demo timestamps (`lib/mock-data.ts`) so the
 * seeded history looks like it happened over real time. Actual task
 * progress no longer runs on a clock — it advances on real execution and
 * verification (see `lib/monitor.ts`). */
export const REAL_SECONDS_PER_SIMULATED_HOUR = 5;

export function simulatedHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * REAL_SECONDS_PER_SIMULATED_HOUR * 1000).toISOString();
}
