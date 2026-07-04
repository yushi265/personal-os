import { AbstractInputSuggest, Modal, Notice, Setting, TFile, TFolder, type App } from "obsidian";
import type { Entity, EntityType, Priority } from "../../domain/entity";
import { PRIORITIES } from "../../domain/entity";
import type { EntityService } from "../../services/EntityService";
import type { IndexStore } from "../../infra/IndexStore";
import type { POSSettings } from "../../settings/settings";
import { entityCreatedNotice, t } from "../../i18n/ja";
import { addModalButtonRow, bindEnterSubmit, bindModEnterSubmit, bindRequiredField, markRequired } from "./modalHelpers";

class EntitySuggest extends AbstractInputSuggest<Entity> {
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

export interface CreateEntityModalOptions {
	entityService: EntityService;
	store: IndexStore;
	settings: POSSettings;
	initialType?: EntityType;
	/** 呼び出し元(ManageViewの「+ 新規」等)が親を事前セットするためのオプション(design-ui-first.md §4.2) */
	initialParentPath?: string;
	onCreated?: (path: string) => void;
	/** 作成後にノートを開くかどうか(デフォルトtrue)。ドリルダウンUIからの作成では画面遷移させたくないためfalseを渡す */
	openAfterCreate?: boolean;
}

export class CreateEntityModal extends Modal {
	private type: EntityType;
	private title = "";
	private priority: Priority;
	private due = "";
	private templateName = "";
	private parentPath: string | undefined;

	constructor(
		app: App,
		private opts: CreateEntityModalOptions
	) {
		super(app);
		this.type = opts.initialType ?? "goal";
		this.priority = opts.settings.defaultPriority;
		this.parentPath = opts.initialParentPath;
	}

	onOpen(): void {
		bindModEnterSubmit(this.contentEl, () => void this.submit());
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle(t("modal.createEntity.title"));
		let titleValidation: { revalidate: () => void } | undefined;

		new Setting(contentEl).setName(t("modal.createEntity.type")).addDropdown((dropdown) =>
			dropdown
				.addOptions({ goal: "goal", project: "project", ticket: "ticket" })
				.setValue(this.type)
				.onChange((value) => {
					this.type = value as EntityType;
					this.parentPath = undefined;
					this.render();
				})
		);

		let titleInputEl: HTMLInputElement | undefined;
		const titleSetting = new Setting(contentEl).setName(t("modal.createEntity.titleField"));
		markRequired(titleSetting.nameEl);
		titleSetting.addText((text) => {
			titleInputEl = text.inputEl;
			text
				.setPlaceholder(t("modal.createEntity.titleFieldPlaceholder"))
				.setValue(this.title)
				.onChange((value) => {
					this.title = value;
					titleValidation?.revalidate();
				});
		});
		titleInputEl?.focus();
		if (titleInputEl) bindEnterSubmit(titleInputEl, () => void this.submit());

		if (this.type === "project" || this.type === "ticket") {
			const parentType: EntityType = this.type === "project" ? "goal" : "project";
			new Setting(contentEl).setName(t("modal.createEntity.parent")).addText((text) => {
				if (this.parentPath) {
					const parentEntity = this.opts.store.get(this.parentPath);
					if (parentEntity) text.setValue(parentEntity.title);
				}
				new EntitySuggest(
					this.app,
					text.inputEl,
					() => this.opts.store.listByType(parentType),
					(entity) => {
						this.parentPath = entity.path;
					}
				);
				text.onChange(() => {
					// 手入力のみでサジェスト未選択の場合は親なしとして扱う
					this.parentPath = undefined;
				});
			});
		}

		new Setting(contentEl).setName(t("modal.createEntity.priority")).addDropdown((dropdown) =>
			dropdown
				.addOptions(Object.fromEntries(PRIORITIES.map((p) => [p, p])))
				.setValue(this.priority)
				.onChange((value) => {
					this.priority = value as Priority;
				})
		);

		new Setting(contentEl).setName(t("modal.createEntity.due")).addText((text) =>
			text.setPlaceholder("YYYY-MM-DD").onChange((value) => {
				this.due = value;
			})
		);

		const templates = this.listTemplates();
		if (templates.length > 0) {
			new Setting(contentEl).setName(t("modal.createEntity.template")).addDropdown((dropdown) => {
				dropdown.addOption("", "");
				for (const name of templates) dropdown.addOption(name, name);
				dropdown.onChange((value) => {
					this.templateName = value;
				});
			});
		}

		const submitBtn = addModalButtonRow(contentEl, {
			submitLabel: t("modal.createEntity.submit"),
			onSubmit: () => void this.submit(),
			onCancel: () => this.close(),
		});
		if (titleInputEl) titleValidation = bindRequiredField(titleInputEl, submitBtn, () => this.title);
	}

	private listTemplates(): string[] {
		const folderPath = `${this.opts.settings.rootDirectory}/${this.opts.settings.folders.templates}`;
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) return [];
		return folder.children.filter((c): c is TFile => c instanceof TFile).map((c) => c.name);
	}

	private async submit(): Promise<void> {
		if (!this.title.trim()) {
			new Notice(t("modal.createEntity.titleRequired"));
			return;
		}

		const input: Parameters<EntityService["create"]>[0] = {
			type: this.type,
			title: this.title.trim(),
			priority: this.priority,
			due: this.due || undefined,
			templateName: this.templateName || undefined,
			goal: this.type === "project" ? this.parentPath : undefined,
			project: this.type === "ticket" ? this.parentPath : undefined,
		};

		const file = await this.opts.entityService.create(input);
		this.close();
		this.opts.onCreated?.(file.path);
		if (this.opts.openAfterCreate ?? true) {
			await this.app.workspace.getLeaf(false).openFile(file);
		} else {
			new Notice(entityCreatedNotice(this.title.trim()));
		}
	}
}
