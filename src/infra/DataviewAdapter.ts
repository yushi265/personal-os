import type { App } from "obsidian";
import { extractEmojiDate, extractInline, extractInlineList, normalizePriority, stripMetadata } from "../domain/todo";
import type { Todo } from "../domain/todo";
import type { DataviewApi, STask } from "./dataview-types";
import type { IndexStore } from "./IndexStore";
import type { TodoProvider } from "./types";

/**
 * Dataview APIへのアクセスを一手に引き受けるAdapter。
 * IndexStoreを介してTodoの所属ノートtype(ticket/project/inbox)を解決する。
 */
export class DataviewAdapter implements TodoProvider {
	constructor(
		private app: App,
		private store: IndexStore
	) {}

	get available(): boolean {
		return !!this.plugins["dataview"];
	}

	private get plugins(): Record<string, unknown> {
		return (this.app as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins.plugins;
	}

	private get api(): DataviewApi | null {
		const plugin = this.plugins["dataview"] as { api?: DataviewApi } | undefined;
		return plugin?.api ?? null;
	}

	/** 1ノート内の全タスクをTodoへ変換 */
	async getTodos(path: string): Promise<Todo[]> {
		const page = this.api?.page(path);
		if (!page?.file?.tasks) return [];
		return page.file.tasks.values.map((t) => this.toTodo(t, path));
	}

	private toTodo(t: STask, filePath: string): Todo {
		return {
			filePath,
			line: t.line,
			text: stripMetadata(t.text),
			rawText: t.text,
			done: t.completed,
			dueDate: extractEmojiDate(t.text, "📅"),
			startDate: extractEmojiDate(t.text, "🛫"),
			doneDate: extractEmojiDate(t.text, "✅"),
			priority: normalizePriority(t.priority ?? extractInline(t.text, "priority")),
			labels: extractInlineList(t.text, "labels"),
			parentType: this.resolveParentType(filePath),
			parentPath: filePath,
		};
	}

	private resolveParentType(filePath: string): "ticket" | "project" | "inbox" {
		const type = this.store.get(filePath)?.type;
		if (type === "ticket" || type === "project" || type === "inbox") return type;
		return "inbox";
	}
}
