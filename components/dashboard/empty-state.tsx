import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center">
      <div className="bg-muted flex size-11 items-center justify-center rounded-full">
        <Icon className="text-muted-foreground size-5" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
