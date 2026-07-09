import { Skeleton } from "@/components/ui/skeleton";
import { LoadingStatus } from "@/components/dashboard/loading-status";

export default function HistoryLoading() {
  return (
    <div>
      <LoadingStatus label="Reconstructing the activity timeline..." />
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-[28rem] rounded-2xl" />
    </div>
  );
}
