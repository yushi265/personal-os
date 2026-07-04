import type { Transition, Variants } from "motion/react";

/**
 * モーション共通定義(design-browser-ui.md P6)。
 * prefers-reduced-motion時はコンポーネント側で `useReducedMotion()`(motion/react)を見て
 * transition を { duration: 0 } に差し替える。variants自体は座標のみを持ち、
 * durationは呼び出し側でreduced-motion分岐したtransitionを渡す。
 */

export const EASE_STANDARD = [0.22, 1, 0.36, 1] as const;

// ルート遷移(PageTransition)専用。スライドなし・知覚できるかできないか程度の極短フェードのみ。
export const routeFadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

// リストのスタッガー表示は撤去済み(ページ遷移が瞬時になった結果、行が刻みで出る方が「待たされ感」になるため)。
// staggerChildren を持たせず、子要素は listTransition の短いフェードで一斉に表示する。
export const staggerContainer: Variants = {
  initial: {},
  animate: {},
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
};

// EmptyState などページ内要素のふわっとした表示用(P6-C11)。ルート遷移には使わない。
export function pageTransition(reduced: boolean): Transition {
  return reduced ? { duration: 0 } : { duration: 0.2, ease: EASE_STANDARD };
}

export function listTransition(reduced: boolean): Transition {
  return reduced ? { duration: 0 } : { duration: 0.1, ease: EASE_STANDARD };
}

// ルート遷移専用の極短トランジション(0.06s)。exitは持たせない(離脱待ちをなくし瞬時感を出す)。
export function routeTransition(reduced: boolean): Transition {
  return reduced ? { duration: 0 } : { duration: 0.06, ease: EASE_STANDARD };
}

export function springTransition(reduced: boolean): Transition {
  return reduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 };
}
