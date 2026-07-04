import * as React from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { fadeSlideVariants, pageTransition } from "@/lib/motion";

// ルート遷移トランジション(design P6-A2)。pathnameをkeyにしてAnimatePresenceで前画面をフェードアウトさせつつ
// 次画面をフェード+軽い上方向スライドで入れる。60fps維持のためtransform/opacityのみ操作する。
export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const reduced = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={fadeSlideVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition(!!reduced)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
