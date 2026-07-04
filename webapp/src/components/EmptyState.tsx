import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { pageTransition } from "@/lib/motion";

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}

// 空状態のふわっと表示(design P6-C11)。
export function EmptyState({ icon: Icon, title, body, action }: EmptyStateProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={pageTransition(!!reduced)}
      className="flex flex-col items-center gap-3 py-16 text-center"
    >
      <div className="rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </motion.div>
  );
}
