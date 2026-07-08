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

// 画面表示時の「ふわっと波打って広がる」エントランス(2026-07-08 ユーザー要望)。
// 一度スタッガーを撤去した経緯(行が刻みで出ると瞬遷移では「待たされ感」になる)があるため、
// 再導入にあたり待たされ感を出さない制約を置く:
//   - 遅延ステップは要素あたり20〜35ms・遅延合計の上限0.25s(waveTransitionでclamp)
//     (60ms/上限0.45s/柔らかspringのゆっくり版も試したが、比較の結果こちらを採用: 2026-07-08)
//   - 入場自体は速いspring。軽いアンダーダンピングのオーバーシュートが「波の余韻」を作る
// staggerChildrenは使わず、呼び出し側がindexを渡して遅延を明示する(子のtransition propと
// オーケストレーションの競合を避けるため)。
export const staggerContainer: Variants = {
  initial: {},
  animate: {},
};

export const waveItem: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
};

const WAVE_MAX_DELAY_S = 0.25;

export function waveTransition(reduced: boolean, index: number, stepS = 0.035): Transition {
  if (reduced) return { duration: 0 };
  return {
    delay: Math.min(index * stepS, WAVE_MAX_DELAY_S),
    type: "spring",
    stiffness: 420,
    damping: 28,
    mass: 0.9,
  };
}

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
