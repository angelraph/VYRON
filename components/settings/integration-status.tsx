import { CheckCircle2, CircleDashed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IntegrationStatus } from "@/lib/integrations";

export function IntegrationStatusCard({
  statuses,
}: {
  statuses: IntegrationStatus[];
}) {
  return (
    <Card className="glass border-0 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-sm font-medium">Integrations</CardTitle>
      </CardHeader>
      <CardContent className="divide-border divide-y px-5">
        {statuses.map((status) => (
          <div key={status.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            {status.configured ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            ) : (
              <CircleDashed className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium">{status.label}</p>
              <p className="text-muted-foreground text-xs">
                {status.description}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
