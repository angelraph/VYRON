"use client";

import { motion } from "framer-motion";
import {
  FlaskConical,
  PenTool,
  FileCode2,
  ShieldCheck,
  Megaphone,
  Rocket,
} from "lucide-react";
import { SAMPLE_WORKFLOW_STAGES } from "@/lib/constants";

const ICONS = [FlaskConical, PenTool, FileCode2, ShieldCheck, Megaphone, Rocket];

export function WorkflowPreview() {
  return (
    <div className="glass noise-overlay relative overflow-hidden rounded-3xl p-6 sm:p-10">
      <div className="mb-8 flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Goal Interpreter output
        </p>
        <p className="font-display text-xl font-semibold sm:text-2xl">
          &ldquo;Launch my NFT collection&rdquo;
        </p>
      </div>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-0">
        {SAMPLE_WORKFLOW_STAGES.map((stage, i) => {
          const Icon = ICONS[i];
          const isLast = i === SAMPLE_WORKFLOW_STAGES.length - 1;
          return (
            <div key={stage} className="relative flex flex-1 items-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
                className="glass relative z-10 flex w-full flex-col items-center gap-2 rounded-2xl px-4 py-5 text-center"
              >
                <div className="bg-gradient-brand flex size-9 items-center justify-center rounded-full">
                  <Icon className="size-4 text-primary-foreground" />
                </div>
                <span className="text-sm font-medium">{stage}</span>
                <span className="text-[11px] text-muted-foreground">
                  Stage {i + 1} of {SAMPLE_WORKFLOW_STAGES.length}
                </span>
              </motion.div>

              {!isLast && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.12 + 0.2 }}
                  style={{ transformOrigin: "left" }}
                  className="via-cyan/60 z-0 hidden h-px flex-1 bg-gradient-to-r from-violet/60 to-transparent sm:block"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
