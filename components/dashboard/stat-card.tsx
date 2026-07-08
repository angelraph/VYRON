import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  className,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn("glass gap-0 border-0 py-4", className)}>
      <CardContent className="flex items-start justify-between px-5">
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="font-display mt-1 text-2xl font-semibold">{value}</p>
          {hint && (
            <p className="text-muted-foreground/80 mt-1 text-xs">{hint}</p>
          )}
        </div>
        <div className="bg-gradient-brand flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="text-primary-foreground size-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}
