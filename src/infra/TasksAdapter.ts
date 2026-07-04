import type { App } from "obsidian";

export { toggleTodoLine } from "../domain/todo";

/**
 * Tasksプラグインの存在チェックのみを担う。
 * Todoの記法解釈はDataview経由で完結するため、完了トグル自体は domain/todo.ts の
 * toggleTodoLine() を自前実装として使う(re-exportのみ)。
 */
export class TasksAdapter {
	constructor(private app: App) {}

	get available(): boolean {
		return !!(this.app as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins.plugins[
			"obsidian-tasks-plugin"
		];
	}
}
