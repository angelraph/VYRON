/** How fast simulated execution time moves relative to the wall clock.
 * At 5 real seconds per simulated hour, a 6h task finishes in 30s and a
 * 24h audit in 2 minutes — fast enough to watch live, slow enough to feel
 * like real work is happening rather than an instant flip. */
export const REAL_SECONDS_PER_SIMULATED_HOUR = 5;

/** How long the autonomous verification pass takes once a task is
 * delivered, before VYRON decides whether to auto-approve or hold it
 * longer for a closer look. */
export const REVIEW_WINDOW_SIMULATED_HOURS = 1;

/** Below this trust score, VYRON extends the review window instead of
 * auto-approving immediately — a real behavioral consequence of the trust
 * score computed at assignment time, not a fixed delay. */
export const AUTO_APPROVE_TRUST_THRESHOLD = 70;

export function simulatedHoursElapsedSince(iso: string): number {
  return (Date.now() - Date.parse(iso)) / 1000 / REAL_SECONDS_PER_SIMULATED_HOUR;
}

export function simulatedHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * REAL_SECONDS_PER_SIMULATED_HOUR * 1000).toISOString();
}
