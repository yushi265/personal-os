import * as React from "react";
import { useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { routeFadeVariants, routeTransition } from "@/lib/motion";

// ルート遷移(design P6-A2 → ユーザーフィードバックにより瞬遷移へ変更)。
// スライドと退場(exit)アニメを撤去し、離脱待ちをなくして体感を最速にする。
// 前画面は即座にアンマウントされ、次画面だけ知覚できるかできない程度の極短フェードで入る。
export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const reduced = useReducedMotion();

  return (
    <motion.div
      key={location.pathname}
      variants={routeFadeVariants}
      initial="initial"
      animate="animate"
      transition={routeTransition(!!reduced)}
    >
      {children}
    </motion.div>
  );
}
