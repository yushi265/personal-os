/**
 * Domain層: 進捗自動計算(design.md §4.1)。
 * このファイルはObsidian APIに一切依存しない純粋TypeScriptとする。
 */

import { isCancelledTodo, type Todo } from "./todo";

/** Ticketの進捗: 完了Todo数 / 全Todo数(cancelledを母数から除外)の四捨五入(%)。母数0件は0 */
export function calcTicketProgress(todos: Todo[]): number {
	const active = todos.filter((t) => !isCancelledTodo(t));
	if (active.length === 0) return 0;
	const done = active.filter((t) => t.done).length;
	return Math.round((done / active.length) * 100);
}

/** Projectの進捗: 配下Ticket進捗 + 直下Todo(Ticket1件相当)の平均 */
export function calcProjectProgress(ticketProgresses: number[], directTodos: Todo[]): number {
	const parts = [...ticketProgresses];
	if (directTodos.length > 0) {
		parts.push(calcTicketProgress(directTodos));
	}
	if (parts.length === 0) return 0;
	return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}
