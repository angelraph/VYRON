"use client";

import { motion } from "framer-motion";
import { Target, Users, BadgeCheck } from "lucide-react";

const STEPS = [
  {
    icon: Target,
    title: "State the objective",
    description:
      "Type one high-level goal — \"launch my startup,\" \"ship this NFT drop.\" No forms, no configuration.",
  },
  {
    icon: Users,
    title: "VYRON assembles the team",
    description:
      "The Goal Interpreter builds a dependency-ordered workflow and the matching engine hires the best ASP for every task.",
  },
  {
    icon: BadgeCheck,
    title: "Execution, verified and paid",
    description:
      "Escrow locks on assignment, releases on verified delivery. You watch the timeline — you never manage the work.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-24">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="text-xs font-medium tracking-widest text-cyan uppercase">
          How it works
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Three steps. Zero busywork.
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: i * 0.1 }}
            className="glass relative flex flex-col gap-4 rounded-2xl p-6"
          >
            <span className="font-display absolute top-5 right-5 text-4xl font-semibold text-foreground/10">
              0{i + 1}
            </span>
            <div className="bg-gradient-brand flex size-10 items-center justify-center rounded-xl">
              <step.icon className="size-5 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-medium">{step.title}</h3>
            <p className="text-sm text-muted-foreground">
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
