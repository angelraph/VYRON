import { Skeleton } from "@/components/ui/skeleton";
import { LoadingStatus } from "@/components/dashboard/loading-status";

export default function MarketplaceLoading() {
  return (
    <div>
      <LoadingStatus label="Scanning the agent marketplace..." />
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 w-56 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
