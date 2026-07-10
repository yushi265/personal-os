/**
 * Status/priorityバッジの色分けロジック(design-ui-first.md追補: UI磨き込み Phase N5)。
 * 編集可能なStatusCell/PriorityCellと、表示専用のStatusBadge/PriorityLabel(Phase V1)の
 * 双方から参照する共通ロジック。マークアップ自体はコンポーネント側に残す。
 */

const STATUS_COLOR_CLASS: Record<string, string> = {
	doing: "pos-status-accent",
	active: "pos-status-accent",
	waiting: "pos-status-warning",
	review: "pos-status-review",
	done: "pos-status-done",
	archived: "pos-status-done",
	cancelled: "pos-status-done",
};

/** 未知のstatus値は"default"にフォールバックする */
export function statusColorClass(status: string): string {
	return STATUS_COLOR_CLASS[status] ?? "pos-status-default";
}

export const PRIORITY_ICON: Record<string, string> = { high: "↑", low: "↓" };

export function priorityColorClass(priority: string): string {
	return `pos-priority-${priority || "unset"}`;
}
