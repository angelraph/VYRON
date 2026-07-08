"use client";

import { motion } from "framer-motion";
import { CORE_FEATURES } from "@/lib/constants";

export function FeaturesGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-24">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="text-xs font-medium tracking-widest text-violet uppercase">
          Capabilities
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          One goal in. A coordinated agent economy out.
        </h2>
        <p className="mt-4 text-muted-foreground">
          VYRON operates like an autonomous COO — planning, hiring, tracking
          and paying a network of specialized agents on your behalf.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CORE_FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: (i % 4) * 0.08 }}
            className="glass group relative flex flex-col gap-3 rounded-2xl p-5 transition-transform hover:-translate-y-1"
          >
            <div className="bg-gradient-brand flex size-9 items-center justify-center rounded-lg">
              <feature.icon className="size-4.5 text-primary-foreground" />
            </div>
            <h3 className="font-medium">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
