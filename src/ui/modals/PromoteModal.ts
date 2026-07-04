import { AbstractInputSuggest, Modal, Notice, Setting, type App } from "obsidian";
import type { Entity } from "../../domain/entity";
import type { Todo } from "../../domain/todo";
import { stripMetadata } from "../../domain/todo";
import type { IndexStore } from "../../infra/IndexStore";
import type { PromoteService, SourceTodoAction } from "../../services/PromoteService";
import { t } from "../../i18n/ja";

class ProjectSuggest extends AbstractInputSuggest<Entity> {
	constructor(
		app: App,
		inputEl: HTMLInputElement,
		private candidates: () => Entity[],
		private onPick: (e: Entity) => void
	) {
		super(app, inputEl);
	}

	getSuggestions(query: string): Entity[] {
		const q = query.toLowerCase();
		return this.candidates().filter((e) => e.title.toLowerCase().includes(q));
	}

	renderSuggestion(value: Entity, el: HTMLElement): void {
		el.setText(value.title);
	}

	selectSuggestion(value: Entity): void {
		this.setValue(value.title);
		this.onPick(value);
		this.close();
	}
}

export interface PromoteTodoModalOptions {
	promoteService: PromoteService;
	store: IndexStore;
	todo: Todo;
	/** Dataview/Tasks有効時のみtrue。falseの場合はonOpenで即座に閉じる(誤起動防御、detail-design.md §8.1) */
	todoFeatures: boolean;
}

/** Todo→Ticket昇格モーダル(detail-design.md §5.1 PromoteModal / §4.3) */
export class PromoteTodoModal extends Modal {
	private newTitle: string;
	private projectPath: string | undefined;
	private sourceAction: SourceTodoAction = "link";

	constructor(
		app: App,
		private opts: PromoteTodoModalOptions
	) {
		super(app);
		this.newTitle = stripMetadata(opts.todo.text);
	}

	onOpen(): void {
		if (!this.opts.todoFeatures) {
			new Notice(t("E001"));
			this.close();
			return;
		}
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle(t("modal.promoteTodo.title"));

		new Setting(contentEl).setName(t("modal.promoteTodo.newTitle")).addText((text) =>
			text.setValue(this.newTitle).onChange((value) => {
				this.newTitle = value;
			})
		);

		new Setting(contentEl).setName(t("modal.promoteTodo.project")).addText((text) => {
			new ProjectSuggest(
				this.app,
				text.inputEl,
				() => this.opts.store.listByType("project"),
				(entity) => {
					this.projectPath = entity.path;
				}
			);
			text.onChange(() => {
				// 手入力のみでサジェスト未選択の場合は所属Projectなしとして扱う
				this.projectPath = undefined;
			});
		});

		new Setting(contentEl).setName(t("modal.promoteTodo.sourceAction")).addDropdown((dropdown) =>
			dropdown
				.addOptions({
					delete: t("modal.promoteTodo.sourceAction.delete"),
					complete: t("modal.promoteTodo.sourceAction.complete"),
					link: t("modal.promoteTodo.sourceAction.link"),
				})
				.setValue(this.sourceAction)
				.onChange((value) => {
					this.sourceAction = value as SourceTodoAction;
				})
		);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(t("modal.promoteTodo.submit"))
				.setCta()
				.onClick(() => void this.submit())
		);
	}

	private async submit(): Promise<void> {
		if (!this.newTitle.trim()) {
			new Notice(t("modal.createEntity.titleRequired"));
			return;
		}

		try {
			await this.opts.promoteService.promoteTodoToTicket(this.opts.todo, {
				newTitle: this.newTitle.trim(),
				projectPath: this.projectPath,
				sourceAction: this.sourceAction,
			});
			this.close();
		} catch {
			// PromoteService側でNotice表示済み。モーダルは開いたまま再試行させる。
		}
	}
}

export interface PromoteTicketModalOptions {
	promoteService: PromoteService;
	ticketPath: string;
	ticketTitle: string;
}

/** Ticket→Project昇格の確認モーダル */
export class PromoteTicketModal extends Modal {
	constructor(
		app: App,
		private opts: PromoteTicketModalOptions
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.setTitle(t("modal.promoteTicket.title"));
		contentEl.createEl("p", {
			text: `${t("modal.promoteTicket.confirmPrefix")}${this.opts.ticketTitle}${t("modal.promoteTicket.confirmSuffix")}`,
		});
		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(t("modal.promoteTicket.submit"))
				.setCta()
				.onClick(() => void this.submit())
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async submit(): Promise<void> {
		try {
			await this.opts.promoteService.promoteTicketToProject(this.opts.ticketPath);
			this.close();
		} catch {
			// PromoteService側でNotice表示済み
		}
	}
}
