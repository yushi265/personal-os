import type { Transition, Variants } from "motion/react";

/**
 * モーション共通定義(design-browser-ui.md P6)。
 * prefers-reduced-motion時はコンポーネント側で `useReducedMotion()`(motion/react)を見て
 * transition を { duration: 0 } に差し替える。variants自体は座標のみを持ち、
 * durationは呼び出し側でreduced-motion分岐したtransitionを渡す。
 */

export const EASE_STANDARD = [0.22, 1, 0.36, 1] as const;

export const fadeSlideVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.03 },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
};

export function pageTransition(reduced: boolean): Transition {
  return reduced ? { duration: 0 } : { duration: 0.2, ease: EASE_STANDARD };
}

export function listTransition(reduced: boolean): Transition {
  return reduced ? { duration: 0 } : { duration: 0.18, ease: EASE_STANDARD };
}

export function springTransition(reduced: boolean): Transition {
  return reduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 };
}
