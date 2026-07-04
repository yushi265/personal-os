import { Notice } from "obsidian";
import type { Priority } from "../domain/entity";
import { today } from "../domain/date";
import { appendTodoToSection, buildTodoLine, rebuildTodoLine, toggleTodoLine, updateTodoLine } from "../domain/todo";
import type { BuildTodoLineInput, Todo, TodoPatch } from "../domain/todo";
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

export type TodoWriteResult = "ok" | "conflict";

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

	/** 完了トグル。戻り値はline-mismatch(行内容の不一致)検知用(design-browser-ui.md §5.4のTodo 409判定にも利用) */
	async toggle(todo: Todo): Promise<TodoWriteResult> {
		const expected = rebuildTodoLine(todo);
		const next = toggleTodoLine(expected, today());
		const result = await this.repo.editLine(todo.filePath, todo.line, expected, next);
		return this.handleMismatch(result, todo.filePath);
	}

	/** 削除 */
	async remove(todo: Todo): Promise<TodoWriteResult> {
		const expected = rebuildTodoLine(todo);
		const result = await this.repo.editLine(todo.filePath, todo.line, expected, null);
		return this.handleMismatch(result, todo.filePath);
	}

	/** Preview「その場でTodo追加」: 指定ノートの "## Todo" セクション末尾へ追記する(design-ui-first.md §4.4) */
	async addToSection(path: string, input: BuildTodoLineInput): Promise<void> {
		const line = buildTodoLine(input);
		await this.repo.processBody(path, (body) => appendTodoToSection(body, line));
	}

	/**
	 * Todo削除のUndo: 削除前にrebuildTodoLine()で退避しておいた行をそのまま "## Todo" セクション末尾へ復元する。
	 * 元の行位置(ネスト位置)は復元しない(末尾での妥協)。
	 */
	async restoreLine(parentPath: string, line: string): Promise<void> {
		await this.repo.processBody(parentPath, (body) => appendTodoToSection(body, line));
	}

	/** インライン編集(text/due/priority): ManageView/Previewの両方から共通利用(design-ui-first.md §4.5) */
	async updateInline(todo: Todo, patch: TodoPatch): Promise<TodoWriteResult> {
		const expected = rebuildTodoLine(todo);
		const next = updateTodoLine(todo, patch);
		const result = await this.repo.editLine(todo.filePath, todo.line, expected, next);
		return this.handleMismatch(result, todo.filePath);
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

	private async handleMismatch(result: EditLineResult, path: string): Promise<TodoWriteResult> {
		if (result !== "line-mismatch") return "ok";
		new Notice(t("E003"));
		const file = this.repo.getFile(path);
		if (file) await this.indexer.reindexFile(file);
		return "conflict";
	}

	private inboxPath(): string {
		return `${this.settings.rootDirectory}/${this.settings.folders.inbox}/inbox.md`;
	}
}
