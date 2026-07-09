import { Skeleton } from "@/components/ui/skeleton";
import { LoadingStatus } from "@/components/dashboard/loading-status";

export default function AgentDetailLoading() {
  return (
    <div>
      <LoadingStatus label="Loading agent profile and track record..." />
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </div>
  );
}
