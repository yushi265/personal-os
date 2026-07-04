import { motion, useReducedMotion } from "motion/react";
import { springTransition } from "@/lib/motion";

// 進捗バー(design P6-B5)。値変更(初回含む)にwidthがspringで追従する。
export function ProgressBar({ value }: { value?: number }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const reduced = useReducedMotion();

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={springTransition(!!reduced)}
        />
      </div>
      <span className="w-9 text-right text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}
