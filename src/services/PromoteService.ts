import { Notice, type TFile } from "obsidian";
import { rebuildTodoLine, toggleTodoLine } from "../domain/todo";
import type { Todo } from "../domain/todo";
import { today } from "../domain/date";
import type { ActivityLogger } from "../infra/types";
import type { IndexStore } from "../infra/IndexStore";
import type { VaultRepository } from "../infra/VaultRepository";
import type { EntityService } from "./EntityService";
import { t } from "../i18n/ja";

export type SourceTodoAction = "delete" | "complete" | "link";

export interface PromoteOptions {
	newTitle: string;
	projectPath?: string;
	sourceAction: SourceTodoAction;
	template?: string;
}

/** 元Todo行がPromote実行までに他所で変更されていた場合(editLineのline-mismatch)に投げる */
export class PromoteConflictError extends Error {
	constructor() {
		super("line-mismatch");
		this.name = "PromoteConflictError";
	}
}

/**
 * Todo→Ticket / Ticket→Project 昇格(design.md §4.3, detail-design.md §4.3)。
 */
export class PromoteService {
	constructor(
		private repo: VaultRepository,
		private store: IndexStore,
		private entityService: EntityService,
		private log: ActivityLogger
	) {}

	/** Todo→Ticket昇格。①Ticket生成→②本文へTodo移設→③元Todo行の処理→④ログ。失敗時は生成ノートをロールバック */
	async promoteTodoToTicket(todo: Todo, opt: PromoteOptions): Promise<void> {
		let created: TFile | null = null;
		try {
			// ① Ticketノート生成(goal/projectは所属Projectのfrontmatterから継承)
			created = await this.entityService.create({
				type: "ticket",
				title: opt.newTitle,
				project: opt.projectPath,
				goal: this.inheritGoal(opt.projectPath),
				templateName: opt.template,
			});

			// ② 元Todo本文をTicketノートへ移設(## Todo セクション配下、トップレベル項目としてインデントは除去)
			await this.repo.processBody(
				created.path,
				(body) => `${body}\n## Todo\n${rebuildTodoLine(todo, { stripIndent: true })}\n`
			);

			// ③ 元Todo行の処理
			const result = await this.applySourceTodoAction(todo, opt);
			if (result === "line-mismatch") throw new PromoteConflictError();
			if (result === "not-found") throw new Error("元ノートが見つかりません");

			// ④ ログ
			await this.log.log("promote", `Todo「${todo.text}」→ Ticket「${opt.newTitle}」`);
		} catch (e) {
			if (created) await this.repo.trash(created.path);
			new Notice(e instanceof PromoteConflictError ? t("E004") : t("promote.failed"));
			throw e;
		}
	}

	/** Ticket→Project昇格。既存ノートをProjects/へ移動+frontmatter書換(wikilink維持のためrenameFile方式) */
	async promoteTicketToProject(ticketPath: string): Promise<void> {
		const entity = this.store.get(ticketPath);
		if (!entity) throw new Error(`Entity not found: ${ticketPath}`);

		try {
			const projectFolder = this.repo.getEntityFolder("project");
			const newPath = await this.repo.moveToFolder(ticketPath, projectFolder);

			await this.repo.updateFrontmatter(newPath, (fm) => {
				fm.type = "project";
				fm.status = "backlog";
				delete fm.project;
			});

			await this.log.log("promote", `Ticket「${entity.title}」→ Project`);
		} catch (e) {
			new Notice(t("promote.failed"));
			throw e;
		}
	}

	private inheritGoal(projectPath: string | undefined): string | undefined {
		if (!projectPath) return undefined;
		return this.store.get(projectPath)?.goal;
	}

	private async applySourceTodoAction(todo: Todo, opt: PromoteOptions) {
		const expected = rebuildTodoLine(todo);
		let next: string | null;
		switch (opt.sourceAction) {
			case "delete":
				next = null;
				break;
			case "complete":
				next = toggleTodoLine(expected, today());
				break;
			case "link":
				next = `- [ ] [[${opt.newTitle}]]`;
				break;
		}
		return this.repo.editLine(todo.filePath, todo.line, expected, next);
	}
}
