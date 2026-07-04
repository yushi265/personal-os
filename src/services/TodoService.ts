import { Notice } from "obsidian";
import type { Priority } from "../domain/entity";
import { today } from "../domain/date";
import { buildTodoLine, rebuildTodoLine, toggleTodoLine } from "../domain/todo";
import type { Todo } from "../domain/todo";
import type { EditLineResult } from "../infra/VaultRepository";
import type { VaultRepository } from "../infra/VaultRepository";
import type { IndexStore } from "../infra/IndexStore";
import type { Indexer } from "../infra/Indexer";
import type { POSSettings } from "../settings/settings";
import { t } from "../i18n/ja";

export interface QuickAddInput {
	text: string;
	target: "inbox" | string; // "inbox" or ノートpath
	dueDate?: string;
	priority?: Priority;
}

export interface TodoFilter {
	done?: boolean;
	parentPath?: string;
	dueOn?: string; // 指定日以前(due <= dueOn)
	priority?: Priority;
	labels?: string[];
}

export class TodoService {
	constructor(
		private repo: VaultRepository,
		private store: IndexStore,
		private settings: POSSettings,
		private indexer: Indexer
	) {}

	/** QuickAdd: 保存先ノート末尾へTodo行を追記 */
	async quickAdd(input: QuickAddInput): Promise<void> {
		const line = buildTodoLine({ text: input.text, dueDate: input.dueDate, priority: input.priority });

		if (input.target === "inbox") {
			await this.repo.appendOrCreate(this.inboxPath(), `${line}\n`, "---\ntype: inbox\n---\n");
			return;
		}

		await this.repo.processBody(input.target, (body) => `${body.replace(/\n+$/, "")}\n${line}\n`);
	}

	/** 完了トグル */
	async toggle(todo: Todo): Promise<void> {
		const expected = rebuildTodoLine(todo);
		const next = toggleTodoLine(expected, today());
		const result = await this.repo.editLine(todo.filePath, todo.line, expected, next);
		await this.handleMismatch(result, todo.filePath);
	}

	/** 削除 */
	async remove(todo: Todo): Promise<void> {
		const expected = rebuildTodoLine(todo);
		const result = await this.repo.editLine(todo.filePath, todo.line, expected, null);
		await this.handleMismatch(result, todo.filePath);
	}

	/** フィルタ済み一覧(Dashboard/Todo管理画面用) */
	list(filter: TodoFilter): Todo[] {
		return this.store.getAllTodos().filter((todo) => {
			if (filter.done !== undefined && todo.done !== filter.done) return false;
			if (filter.parentPath !== undefined && todo.parentPath !== filter.parentPath) return false;
			if (filter.dueOn !== undefined && !(todo.dueDate && todo.dueDate <= filter.dueOn)) return false;
			if (filter.priority !== undefined && todo.priority !== filter.priority) return false;
			if (filter.labels !== undefined && !filter.labels.every((l) => todo.labels.includes(l))) return false;
			return true;
		});
	}

	private async handleMismatch(result: EditLineResult, path: string): Promise<void> {
		if (result !== "line-mismatch") return;
		new Notice(t("E003"));
		const file = this.repo.getFile(path);
		if (file) await this.indexer.reindexFile(file);
	}

	private inboxPath(): string {
		return `${this.settings.rootDirectory}/${this.settings.folders.inbox}/inbox.md`;
	}
}
