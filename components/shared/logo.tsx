import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-lg font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      VYRON
      <span className="text-gradient-brand">.</span>
    </span>
  );
}
