"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import type { VeeAgentAssignment, VeeEvent } from "@/lib/execution-engine";
import type { TimedVeeEvent } from "@/components/dashboard/execution-pipeline";

// Deferred until a goal is actually submitted — the framer-motion-driven
// pipeline/graph shouldn't add to the JS the initial goal form needs to load.
const ExecutionPipeline = dynamic(
  () =>
    import("@/components/dashboard/execution-pipeline").then(
      (m) => m.ExecutionPipeline,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[20rem] animate-pulse rounded-2xl bg-muted/40" />
    ),
  },
);

const AgentTaskGraph = dynamic(
  () =>
    import("@/components/dashboard/agent-task-graph").then(
      (m) => m.AgentTaskGraph,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[12rem] animate-pulse rounded-2xl bg-muted/40" />
    ),
  },
);

type Phase = "form" | "streaming" | "done" | "error";

export function NewGoalForm() {
  const [phase, setPhase] = useState<Phase>("form");
  const [timeline, setTimeline] = useState<TimedVeeEvent[]>([]);
  const [agentAssignments, setAgentAssignments] = useState<VeeAgentAssignment[]>([]);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (phase === "streaming") return;

    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    const budgetRaw = formData.get("budget");
    const budget = budgetRaw ? Number(budgetRaw) : undefined;

    setError(null);
    setTimeline([]);
    setAgentAssignments([]);
    setGoalId(null);
    setPhase("streaming");

    try {
      const res = await fetch("/api/execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, budget }),
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Too many goals submitted — please wait a moment.");
        setPhase("error");
        return;
      }

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Something went wrong. Try again.");
        setPhase("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalGoalId: string | null = null;
      let sawError = false;

      const consumeLine = (line: string) => {
        if (!line.trim()) return;
        let event: VeeEvent;
        try {
          event = JSON.parse(line);
        } catch (parseError) {
          // A single malformed/truncated line (e.g. a dev-server HMR restart
          // cutting the stream mid-write) shouldn't take down the whole
          // pipeline — skip it and keep listening for the next one.
          console.warn("Skipping malformed execution event", parseError, line);
          return;
        }
        setTimeline((prev) => [...prev, { event, receivedAt: Date.now() }]);
        if (event.stage === "error") {
          sawError = true;
          setError(event.message);
        }
        if (event.goal) {
          finalGoalId = event.goal.id;
        }
        if (event.agentAssignments) {
          setAgentAssignments(event.agentAssignments);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(consumeLine);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeLine(buffer);

      if (sawError) {
        setPhase("error");
      } else if (finalGoalId) {
        setGoalId(finalGoalId);
        setPhase("done");
      } else {
        setError("The execution engine stopped before finishing. Try again.");
        setPhase("error");
      }
    } catch {
      setError("Lost connection to the execution engine. Try again.");
      setPhase("error");
    }
  }

  if (phase === "form") {
    return (
      <Card className="glass border-0 py-6">
        <CardContent className="px-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">What do you want to accomplish?</Label>
              <Textarea
                id="title"
                name="title"
                placeholder="e.g. Launch my NFT collection, grow my newsletter to 10k subscribers, ship a v1 of my SaaS landing page..."
                rows={4}
                className="resize-none text-base"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2 sm:max-w-xs">
              <Label htmlFor="budget">Budget (optional)</Label>
              <Input
                id="budget"
                name="budget"
                type="number"
                min={0}
                placeholder="e.g. 2000"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="bg-gradient-brand text-primary-foreground w-fit"
            >
              Execute Goal
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="glass border-0 py-6">
        <CardContent className="flex flex-col gap-4 px-6">
          <ExecutionPipeline
            timeline={timeline}
            streaming={phase === "streaming"}
            errored={phase === "error"}
          />
          {phase === "error" && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-destructive text-sm">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPhase("form");
                  setError(null);
                  setTimeline([]);
                  setAgentAssignments([]);
                }}
              >
                Try again
              </Button>
            </div>
          )}
          {phase === "streaming" && (
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="size-3 animate-spin" />
              VEE pipeline in progress...
            </p>
          )}
        </CardContent>
      </Card>

      {phase === "done" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Task graph — real agents, real assignments</p>
            {goalId && (
              <Button asChild size="sm" className="bg-gradient-brand text-primary-foreground">
                <a href={`/dashboard/workflows/${goalId}`}>
                  View workflow
                  <ArrowUpRight className="size-3.5" />
                </a>
              </Button>
            )}
          </div>
          <AgentTaskGraph assignments={agentAssignments} />
        </div>
      )}
    </div>
  );
}
