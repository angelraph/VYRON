declare global {
  var __vyronMonitorStarted: boolean | undefined;
}

/** Starts the autonomous engine once per server process. This is what
 * makes VYRON keep working when nobody's looking — tasks advance through
 * their lifecycle on real execution/verification, not on page load. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalThis.__vyronMonitorStarted) return;
  globalThis.__vyronMonitorStarted = true;

  const { executionEngine } = await import("@/lib/engine/executor");
  executionEngine.start();
}
