/**
 * 管理View内キーボード操作(Phase U2)の純粋ロジック。ManageTable.svelte / Manage.svelte から呼ばれる。
 * DOM/Obsidian APIには依存しない(isEditableTargetはダックタイピングでテスト可能にする)。
 */

/** ↑/↓による行フォーカス移動。先頭で↑・末尾で↓は範囲内にクランプする(ループしない) */
export function moveFocus(current: number, length: number, direction: 1 | -1): number {
	if (length === 0) return -1;
	if (current < 0) return direction === 1 ? 0 : length - 1;
	const next = current + direction;
	if (next < 0) return 0;
	if (next >= length) return length - 1;
	return next;
}

interface EditableTargetLike {
	tagName?: string;
	isContentEditable?: boolean;
}

/** 入力欄・編集中セルにフォーカスがある間はView内キーボードショートカットを発動させないためのガード */
export function isEditableTarget(target: EditableTargetLike | null | undefined): boolean {
	if (!target) return false;
	const tag = target.tagName?.toUpperCase();
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!target.isContentEditable;
}
