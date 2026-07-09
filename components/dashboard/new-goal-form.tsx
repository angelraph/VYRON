"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import type { VeeEvent } from "@/lib/execution-engine";

// Deferred until a goal is actually submitted — the framer-motion-driven
// console shouldn't add to the JS the initial goal form needs to load.
const ExecutionConsole = dynamic(
  () =>
    import("@/components/dashboard/execution-console").then(
      (m) => m.ExecutionConsole,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[20rem] animate-pulse rounded-2xl bg-muted/40" />
    ),
  },
);

type Phase = "form" | "streaming" | "done" | "error";

export function NewGoalForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("form");
  const [events, setEvents] = useState<VeeEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (phase === "streaming") return;

    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    const budgetRaw = formData.get("budget");
    const budget = budgetRaw ? Number(budgetRaw) : undefined;

    setError(null);
    setEvents([]);
    setPhase("streaming");

    try {
      const res = await fetch("/api/execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, budget }),
      });

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
          // console — skip it and keep listening for the next one.
          console.warn("Skipping malformed execution event", parseError, line);
          return;
        }
        setEvents((prev) => [...prev, event]);
        if (event.stage === "error") {
          sawError = true;
          setError(event.message);
        }
        if (event.goal) {
          finalGoalId = event.goal.id;
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
        setPhase("done");
        setTimeout(() => router.push(`/dashboard/workflows/${finalGoalId}`), 900);
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
              Give VYRON this goal
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-0 py-6">
      <CardContent className="flex flex-col gap-4 px-6">
        <ExecutionConsole events={events} streaming={phase === "streaming"} />
        {phase === "error" && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-destructive text-sm">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPhase("form");
                setError(null);
                setEvents([]);
              }}
            >
              Try again
            </Button>
          </div>
        )}
        {phase !== "error" && (
          <p
            className={`flex items-center gap-2 text-xs ${phase === "done" ? "text-emerald-400" : "text-muted-foreground"}`}
          >
            {phase === "done" ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <Loader2 className="size-3 animate-spin" />
            )}
            {phase === "done"
              ? "Execution Plan Ready — opening your workflow..."
              : "VEE pipeline in progress..."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
