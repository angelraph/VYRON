import { Brain, Radar, ShieldCheck, Workflow } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { NewGoalForm } from "@/components/dashboard/new-goal-form";
import { Card, CardContent } from "@/components/ui/card";

const STEPS = [
  {
    icon: Brain,
    title: "Interpret",
    description: "Your goal is decomposed into a dependency-ordered workflow.",
  },
  {
    icon: Radar,
    title: "Match",
    description: "Each task is scored against the marketplace for the best ASP.",
  },
  {
    icon: ShieldCheck,
    title: "Escrow",
    description: "Funds lock per task and release only on verified delivery.",
  },
  {
    icon: Workflow,
    title: "Execute",
    description: "Progress streams live on your Workflow board until done.",
  },
];

export default function NewGoalPage() {
  return (
    <div>
      <PageHeader
        title="New goal"
        description="One objective is all VYRON needs — it plans and staffs the rest."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NewGoalForm />
        </div>

        <Card className="glass border-0 py-5">
          <CardContent className="flex flex-col gap-5 px-5">
            <p className="text-sm font-medium">What happens next</p>
            {STEPS.map((step) => (
              <div key={step.title} className="flex items-start gap-3">
                <div className="bg-gradient-brand flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <step.icon className="text-primary-foreground size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
