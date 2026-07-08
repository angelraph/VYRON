"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { savePreferencesAction } from "@/lib/actions/preferences";
import { cn } from "@/lib/utils";
import type { Agent, UserPreferences } from "@/lib/types";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Lagos",
  "Asia/Singapore",
];

export function PreferencesForm({
  preferences,
  agents,
}: {
  preferences: UserPreferences;
  agents: Agent[];
}) {
  const [budget, setBudget] = useState(String(preferences.budget ?? ""));
  const [timezone, setTimezone] = useState(preferences.timezone ?? "UTC");
  const [stack, setStack] = useState(preferences.preferredStack ?? "");
  const [favoriteIds, setFavoriteIds] = useState<string[]>(preferences.favoriteAgentIds);
  const [isPending, startTransition] = useTransition();

  function toggleFavorite(agentId: string) {
    setFavoriteIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId],
    );
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await savePreferencesAction({
        budget: budget ? Number(budget) : null,
        timezone,
        preferredStack: stack || null,
        favoriteAgentIds: favoriteIds,
      });
      toast.success("Preferences saved", {
        description: "VYRON will factor these into future agent matching.",
      });
    });
  }

  return (
    <Card className="glass border-0 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-sm font-medium">Memory & preferences</CardTitle>
      </CardHeader>
      <CardContent className="px-5">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="budget">Default budget (USD)</Label>
              <Input
                id="budget"
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="stack">Preferred stack / languages</Label>
            <Input
              id="stack"
              value={stack}
              onChange={(e) => setStack(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Favorite agents</Label>
            <p className="text-muted-foreground text-xs">
              Favorited agents get a matching boost on future goals.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {agents.map((agent) => {
                const active = favoriteIds.includes(agent.id);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleFavorite(agent.id)}
                    className="outline-none"
                  >
                    <Badge
                      variant={active ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer",
                        active && "bg-gradient-brand text-primary-foreground",
                      )}
                    >
                      {agent.name}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
          <Button
            type="submit"
            disabled={isPending}
            className="bg-gradient-brand text-primary-foreground w-fit"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Save preferences
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
