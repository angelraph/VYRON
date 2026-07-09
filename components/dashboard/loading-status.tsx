import { Radar } from "lucide-react";

/** Narrates what VYRON is doing while a route's data streams in, instead of
 * a bare skeleton with no context — every loading.tsx uses this with copy
 * specific to what that page is pulling. */
export function LoadingStatus({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground mb-4 flex items-center gap-2 text-xs">
      <Radar className="text-violet size-3.5 animate-pulse" />
      {label}
    </div>
  );
}
