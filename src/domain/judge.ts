/**
 * Domain層: Dashboard判定ロジック(design.md §4.2)。
 * このファイルはObsidian APIに一切依存しない純粋TypeScriptとする。
 */

import { OPEN_STATUSES, type Entity, type EntityType } from "./entity";
import type { Todo } from "./todo";
import { addCycle } from "./date";

function openStatusesOf(type: EntityType): ReadonlySet<string> | undefined {
	if (type === "goal" || type === "project" || type === "ticket") return OPEN_STATUSES[type];
	return undefined;
}

/** dueを過ぎ、かつ未完了statusのEntityか(当日はOverdueに含めない) */
export function isOverdue(e: Entity, today: string): boolean {
	if (!e.due) return false;
	const open = openStatusesOf(e.type);
	if (!open) return false;
	return e.due < today && open.has(e.status);
}

/** dueを過ぎ、かつ未完了のTodoか */
export function isTodoOverdue(t: Todo, today: string): boolean {
	return !t.done && !!t.dueDate && t.dueDate < today;
}

/** review_cycleに基づき、レビューが必要な時期に達しているか */
export function isReviewNeeded(e: Entity, today: string): boolean {
	if (!e.reviewCycle) return false;
	if (!e.lastReviewed) return true; // 一度もレビューしていない
	return addCycle(e.lastReviewed, e.reviewCycle) <= today;
}

/** blockersが設定され、かつ未完了statusのProject/Ticketか */
export function isBlocked(e: Entity): boolean {
	if (e.type !== "project" && e.type !== "ticket") return false;
	return e.blockers.length > 0 && OPEN_STATUSES[e.type].has(e.status);
}
