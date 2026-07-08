"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Silently re-fetches the current server component on an interval while
 * `active` — how the UI reflects the autonomous monitor's progress without
 * a manual reload. Renders nothing; stops polling once there's nothing
 * left in flight. */
export function LiveRefresh({
  active,
  intervalMs = 4000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
