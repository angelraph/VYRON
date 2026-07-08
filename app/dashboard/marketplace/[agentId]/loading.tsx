import { Skeleton } from "@/components/ui/skeleton";

export default function AgentDetailLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </div>
  );
}
