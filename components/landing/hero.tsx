"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusTicker } from "@/components/landing/status-ticker";
import { WorkflowPreview } from "@/components/landing/workflow-preview";

export function Hero() {
  return (
    <section className="relative flex flex-col items-center px-4 pt-40 pb-24 sm:pt-48">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass mb-6 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-muted-foreground"
      >
        <Sparkles className="size-3.5 text-violet" />
        Built for the OKX.AI Agent Marketplace
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.05 }}
        className="font-display max-w-3xl text-center text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl md:text-7xl"
      >
        Every goal.{" "}
        <span className="text-gradient-brand">Executed.</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.12 }}
        className="mt-6 max-w-xl text-center text-base text-muted-foreground sm:text-lg"
      >
        VYRON is an autonomous execution agent. Give it one objective — it
        plans the work, hires the right Agent Service Providers, escrows the
        payment, and delivers the outcome. No prompting. No chatbot. Just
        results.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.18 }}
        className="mt-9 flex flex-col items-center gap-4 sm:flex-row"
      >
        <Button
          size="lg"
          asChild
          className="bg-gradient-brand glow-violet text-primary-foreground hover:opacity-90"
        >
          <Link href="/dashboard/new-goal">
            Give VYRON a goal
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button size="lg" variant="outline" asChild className="glass border-0">
          <Link href="/dashboard/marketplace">Explore the marketplace</Link>
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mt-8"
      >
        <StatusTicker />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.35 }}
        className="mt-16 w-full max-w-5xl"
      >
        <WorkflowPreview />
      </motion.div>
    </section>
  );
}
