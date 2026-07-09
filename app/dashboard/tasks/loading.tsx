import { Skeleton } from "@/components/ui/skeleton";
import { LoadingStatus } from "@/components/dashboard/loading-status";

export default function TasksLoading() {
  return (
    <div>
      <LoadingStatus label="Compiling every task across your goals..." />
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="mb-5 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
