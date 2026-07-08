"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentCard } from "@/components/marketplace/agent-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { AGENT_SPECIALIZATIONS } from "@/lib/constants";
import type { Agent } from "@/lib/types";

export function MarketplaceGrid({ agents }: { agents: Agent[] }) {
  const [query, setQuery] = useState("");
  const [specialization, setSpecialization] = useState<string>("all");

  const filtered = useMemo(() => {
    return agents.filter((agent) => {
      const matchesQuery =
        !query.trim() ||
        agent.name.toLowerCase().includes(query.toLowerCase()) ||
        agent.tagline.toLowerCase().includes(query.toLowerCase());
      const matchesSpecialization =
        specialization === "all" ||
        agent.specializations.includes(specialization);
      return matchesQuery && matchesSpecialization;
    });
  }, [agents, query, specialization]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search agents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={specialization} onValueChange={setSpecialization}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="All specializations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All specializations</SelectItem>
            {AGENT_SPECIALIZATIONS.map((spec) => (
              <SelectItem key={spec} value={spec}>
                {spec}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No agents match"
          description="Try a different search term or specialization filter."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
