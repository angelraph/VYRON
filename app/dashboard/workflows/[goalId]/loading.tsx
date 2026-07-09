import { Skeleton } from "@/components/ui/skeleton";
import { LoadingStatus } from "@/components/dashboard/loading-status";

export default function WorkflowDetailLoading() {
  return (
    <div>
      <LoadingStatus label="Rebuilding this goal's execution graph..." />
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-3 sm:flex-1">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
