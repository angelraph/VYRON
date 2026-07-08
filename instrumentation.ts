declare global {
  var __vyronMonitorStarted: boolean | undefined;
}

const TICK_INTERVAL_MS = 4000;

/** Starts the autonomous monitor once per server process. This is what
 * makes VYRON keep working when nobody's looking — tasks advance through
 * their lifecycle on a real clock, not on page load. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalThis.__vyronMonitorStarted) return;
  globalThis.__vyronMonitorStarted = true;

  const { runMonitorTick } = await import("@/lib/monitor");

  setInterval(() => {
    runMonitorTick().catch((error) => {
      console.error("VYRON monitor tick failed", error);
    });
  }, TICK_INTERVAL_MS);
}
