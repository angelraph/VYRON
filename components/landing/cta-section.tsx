"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="glass noise-overlay relative flex flex-col items-center overflow-hidden rounded-3xl px-6 py-16 text-center"
      >
        <div
          aria-hidden
          className="bg-gradient-brand animate-glow-pulse absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full opacity-30 blur-[100px]"
        />
        <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Stop managing work. Start executing goals.
        </h2>
        <p className="mt-4 max-w-md text-muted-foreground">
          Hand VYRON your next objective and watch it hire, coordinate, and
          settle an entire agent network on your behalf.
        </p>
        <Button
          size="lg"
          asChild
          className="bg-gradient-brand glow-violet text-primary-foreground mt-8 hover:opacity-90"
        >
          <Link href="/dashboard/new-goal">
            Give VYRON a goal
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}
