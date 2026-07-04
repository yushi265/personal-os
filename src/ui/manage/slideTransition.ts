import { prefersReducedMotion } from "../reduceMotion";

export interface SlideParams {
	direction: "push" | "pop";
	duration?: number;
}

interface TransitionResult {
	duration: number;
	css?: (t: number, u: number) => string;
}

/**
 * ドリルダウン画面切替のスライドイン(Phase U3)。push=右から、pop=左から入る。translateXベース。
 * Obsidianの「アニメーションを減らす」設定 / OSのprefers-reduced-motionが有効な場合はduration 0で即時表示する。
 */
export function slideIn(_node: Element, { direction, duration = 150 }: SlideParams): TransitionResult {
	if (prefersReducedMotion()) return { duration: 0 };
	const sign = direction === "push" ? 1 : -1;
	return {
		duration,
		css: (t: number, u: number) => `transform: translateX(${u * sign * 100}%);`,
	};
}
