/**
 * Obsidianの「アニメーションを減らす」設定 / OSのprefers-reduced-motionを尊重するための判定(Phase U3)。
 * Obsidianはバージョンにより body へ付与するクラス名が異なりうるため両方の既知クラス名を見つつ、
 * OS設定(prefers-reduced-motion)もフォールバックとして併用する。
 */
export function prefersReducedMotion(): boolean {
	if (typeof document !== "undefined") {
		const body = document.body;
		if (body?.classList.contains("reduce-motion") || body?.classList.contains("is-reduce-motion")) return true;
	}
	if (typeof window !== "undefined" && window.matchMedia) {
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	}
	return false;
}
