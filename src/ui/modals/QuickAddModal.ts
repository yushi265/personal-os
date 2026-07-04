import { AbstractInputSuggest, Modal, Notice, Setting, type App } from "obsidian";
import { PRIORITIES, type Priority } from "../../domain/entity";
import type { IndexStore } from "../../infra/IndexStore";
import type { TodoService } from "../../services/TodoService";
import type { POSSettings } from "../../settings/settings";
import { t } from "../../i18n/ja";

interface TargetOption {
	label: string;
	value: "inbox" | string;
}

class TargetSuggest extends AbstractInputSuggest<TargetOption> {
	constructor(
		app: App,
		inputEl: HTMLInputElement,
		private candidates: () => TargetOption[],
		private onPick: (opt: TargetOption) => void
	) {
		super(app, inputEl);
	}

	getSuggestions(query: string): TargetOption[] {
		const q = query.toLowerCase();
		return this.candidates().filter((c) => c.label.toLowerCase().includes(q));
	}

	renderSuggestion(value: TargetOption, el: HTMLElement): void {
		el.setText(value.label);
	}

	selectSuggestion(value: TargetOption): void {
		this.setValue(value.label);
		this.onPick(value);
		this.close();
	}
}

export interface QuickAddModalOptions {
	todoService: TodoService;
	store: IndexStore;
	settings: POSSettings;
	/** Dataview/Tasks有効時のみtrue。falseの場合はonOpenで即座に閉じる(誤起動防御、detail-design.md §8.1) */
	todoFeatures: boolean;
}

export class QuickAddModal extends Modal {
	private text = "";
	private target: "inbox" | string = "inbox";
	private dueDate = "";
	private priority: Priority;

	constructor(
		app: App,
		private opts: QuickAddModalOptions
	) {
		super(app);
		this.priority = opts.settings.defaultPriority;
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
		this.setTitle(t("modal.quickAdd.title"));

		let textInputEl: HTMLInputElement | undefined;
		new Setting(contentEl).setName(t("modal.quickAdd.text")).addText((text) => {
			textInputEl = text.inputEl;
			text
				.setPlaceholder(t("modal.quickAdd.textPlaceholder"))
				.setValue(this.text)
				.onChange((value) => {
					this.text = value;
				});
			text.inputEl.addEventListener("keydown", (evt) => {
				if (evt.key === "Enter") {
					evt.preventDefault();
					void this.submit();
				}
			});
		});
		textInputEl?.focus();

		new Setting(contentEl).setName(t("modal.quickAdd.target")).addText((text) => {
			text.setValue(t("modal.quickAdd.targetInbox"));
			new TargetSuggest(
				this.app,
				text.inputEl,
				() => this.targetCandidates(),
				(opt) => {
					this.target = opt.value;
				}
			);
			text.onChange(() => {
				// 手入力のみでサジェスト未選択の場合はInboxへフォールバック
				this.target = "inbox";
			});
		});

		new Setting(contentEl).setName(t("modal.quickAdd.due")).addText((text) =>
			text.setPlaceholder("YYYY-MM-DD").onChange((value) => {
				this.dueDate = value;
			})
		);

		const prioritySetting = new Setting(contentEl).setName(t("modal.quickAdd.priority"));
		for (const p of PRIORITIES) {
			prioritySetting.addButton((btn) => {
				btn.setButtonText(p).onClick(() => {
					this.priority = p;
					this.render();
				});
				if (p === this.priority) btn.buttonEl.addClass("pos-quickadd-priority-active");
			});
		}

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(t("modal.quickAdd.submit"))
				.setCta()
				.onClick(() => void this.submit())
		);
	}

	private targetCandidates(): TargetOption[] {
		const projects = this.opts.store.listByType("project").map((e) => ({ label: e.title, value: e.path }));
		const tickets = this.opts.store.listByType("ticket").map((e) => ({ label: e.title, value: e.path }));
		return [{ label: t("modal.quickAdd.targetInbox"), value: "inbox" as const }, ...projects, ...tickets];
	}

	private async submit(): Promise<void> {
		if (!this.text.trim()) {
			new Notice(t("modal.quickAdd.textRequired"));
			return;
		}

		await this.opts.todoService.quickAdd({
			text: this.text.trim(),
			target: this.target,
			dueDate: this.dueDate || undefined,
			priority: this.priority,
		});

		this.close();
		new Notice(t("notice.todoAdded"));
	}
}
