"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { EXECUTION_STAGES } from "@/lib/constants";

/** Decorative loop of the autonomous status feed, used to demonstrate the
 * "no chatbot UI" execution experience before a goal is ever created. */
export function StatusTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % EXECUTION_STAGES.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const stage = EXECUTION_STAGES[index];
  const isDone = stage.key === "completed";

  return (
    <div className="glass flex items-center gap-3 rounded-full px-4 py-2 text-sm">
      {isDone ? (
        <span className="size-2 rounded-full bg-cyan shadow-[0_0_10px_2px] shadow-cyan/60" />
      ) : (
        <Loader2 className="size-3.5 animate-spin text-violet" />
      )}
      <AnimatePresence mode="wait">
        <motion.span
          key={stage.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="text-muted-foreground"
        >
          {stage.label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
