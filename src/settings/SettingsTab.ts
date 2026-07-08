import { Notice, Platform, PluginSettingTab, Setting, type App } from "obsidian";
import type PersonalOSPlugin from "../main";
import type { POSSettings } from "./settings";
import { t } from "../i18n/ja";

type FolderKey = keyof POSSettings["folders"];

export class POSSettingsTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: PersonalOSPlugin
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.plugin.refreshCapability();

		this.renderFolderSection(containerEl);
		this.renderDashboardSection(containerEl);
		this.renderDefaultsSection(containerEl);
		this.renderKanbanSection(containerEl);
		this.renderCapabilitySection(containerEl);
		if (Platform.isDesktopApp) this.renderServerSection(containerEl);
	}

	private async save(): Promise<void> {
		await this.plugin.saveSettings();
		this.plugin.eventBus.emitEvent("settings-updated");
	}

	private renderFolderSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t("settings.section.folders")).setHeading();

		new Setting(containerEl).setName(t("settings.rootDirectory")).addText((text) =>
			text.setValue(this.plugin.settings.rootDirectory).onChange(async (value) => {
				this.plugin.settings.rootDirectory = value;
				await this.save();
			})
		);

		const folderFields: { key: FolderKey; label: string }[] = [
			{ key: "goals", label: t("settings.folders.goals") },
			{ key: "projects", label: t("settings.folders.projects") },
			{ key: "tickets", label: t("settings.folders.tickets") },
			{ key: "inbox", label: t("settings.folders.inbox") },
			{ key: "archive", label: t("settings.folders.archive") },
			{ key: "templates", label: t("settings.folders.templates") },
			{ key: "reviews", label: t("settings.folders.reviews") },
			{ key: "logs", label: t("settings.folders.logs") },
		];
		for (const field of folderFields) {
			new Setting(containerEl).setName(field.label).addText((text) =>
				text.setValue(this.plugin.settings.folders[field.key]).onChange(async (value) => {
					this.plugin.settings.folders[field.key] = value;
					await this.save();
				})
			);
		}

		containerEl.createEl("p", { text: t("settings.folders.renameNotice"), cls: "setting-item-description" });
	}

	private renderDashboardSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t("settings.section.dashboard")).setHeading();

		for (const widget of this.plugin.settings.dashboard.widgets) {
			new Setting(containerEl).setName(widget.id).addToggle((toggle) =>
				toggle.setValue(widget.visible).onChange(async (value) => {
					widget.visible = value;
					await this.save();
				})
			);
		}

		new Setting(containerEl).setName(t("settings.dashboard.recentUpdatesCount")).addText((text) =>
			text.setValue(String(this.plugin.settings.dashboard.recentUpdatesCount)).onChange(async (value) => {
				const n = Number(value);
				if (!Number.isNaN(n)) {
					this.plugin.settings.dashboard.recentUpdatesCount = n;
					await this.save();
				}
			})
		);
	}

	private renderDefaultsSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t("settings.section.defaults")).setHeading();

		new Setting(containerEl).setName(t("settings.defaultReviewCycle")).addDropdown((dropdown) =>
			dropdown
				.addOptions({ daily: "daily", weekly: "weekly", monthly: "monthly", quarterly: "quarterly", yearly: "yearly" })
				.setValue(this.plugin.settings.defaultReviewCycle)
				.onChange(async (value) => {
					this.plugin.settings.defaultReviewCycle = value as typeof this.plugin.settings.defaultReviewCycle;
					await this.save();
				})
		);

		new Setting(containerEl).setName(t("settings.defaultPriority")).addDropdown((dropdown) =>
			dropdown
				.addOptions({ high: "high", medium: "medium", low: "low" })
				.setValue(this.plugin.settings.defaultPriority)
				.onChange(async (value) => {
					this.plugin.settings.defaultPriority = value as typeof this.plugin.settings.defaultPriority;
					await this.save();
				})
		);
	}

	private renderKanbanSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t("settings.section.kanban")).setHeading();
		containerEl.createEl("p", { text: t("settings.kanban.note"), cls: "setting-item-description" });

		for (const status of Object.keys(this.plugin.settings.kanbanColumnNames.project) as Array<
			keyof POSSettings["kanbanColumnNames"]["project"]
		>) {
			new Setting(containerEl).setName(`Project: ${status}`).addText((text) =>
				text.setValue(this.plugin.settings.kanbanColumnNames.project[status]).onChange(async (value) => {
					this.plugin.settings.kanbanColumnNames.project[status] = value;
					await this.save();
				})
			);
		}
		for (const status of Object.keys(this.plugin.settings.kanbanColumnNames.ticket) as Array<
			keyof POSSettings["kanbanColumnNames"]["ticket"]
		>) {
			new Setting(containerEl).setName(`Ticket: ${status}`).addText((text) =>
				text.setValue(this.plugin.settings.kanbanColumnNames.ticket[status]).onChange(async (value) => {
					this.plugin.settings.kanbanColumnNames.ticket[status] = value;
					await this.save();
				})
			);
		}
	}

	private renderCapabilitySection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t("settings.section.capability")).setHeading();

		const dvDetected = !!(this.app as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins.plugins[
			"dataview"
		];
		const tasksDetected = !!(this.app as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins.plugins[
			"obsidian-tasks-plugin"
		];

		const dvSetting = new Setting(containerEl)
			.setName(t("settings.capability.dataview"))
			.setDesc(dvDetected ? t("settings.capability.detected") : t("settings.capability.notDetected"));
		if (!dvDetected) {
			dvSetting.addButton((btn) =>
				btn.setButtonText(t("settings.capability.installLink")).onClick(() => {
					window.open("https://obsidian.md/plugins?id=dataview");
				})
			);
		}

		const tasksSetting = new Setting(containerEl)
			.setName(t("settings.capability.tasks"))
			.setDesc(tasksDetected ? t("settings.capability.detected") : t("settings.capability.notDetected"));
		if (!tasksDetected) {
			tasksSetting.addButton((btn) =>
				btn.setButtonText(t("settings.capability.installLink")).onClick(() => {
					window.open("https://obsidian.md/plugins?id=obsidian-tasks-plugin");
				})
			);
		}
	}

	/** ブラウザUIサーバー設定(design-browser-ui.md §4.5)。Platform.isDesktopAppがfalseの場合はdisplay()側でこのメソッド自体を呼ばない。 */
	private renderServerSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t("settings.section.server")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.server.enabled"))
			.setDesc(t("settings.server.enabledDesc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.server.enabled).onChange(async (value) => {
					this.plugin.settings.server.enabled = value;
					await this.save();
					this.display();
				})
			);

		const actualPortText = this.plugin.httpServer.isRunning
			? `${t("settings.server.actualPortRunning")}${this.plugin.httpServer.actualPort}`
			: t("settings.server.actualPortStopped");
		new Setting(containerEl)
			.setName(t("settings.server.port"))
			.setDesc(`${t("settings.server.portDesc")} (${actualPortText})`)
			.addText((text) =>
				text.setValue(String(this.plugin.settings.server.port)).onChange(async (value) => {
					const n = Number(value);
					if (Number.isInteger(n) && n > 0) {
						this.plugin.settings.server.port = n;
						await this.save();
					}
				})
			);

		new Setting(containerEl)
			.setName(t("settings.server.openInBrowser"))
			.setDesc(t("settings.server.openInBrowserDesc"))
			.addButton((btn) =>
				btn.setButtonText(t("settings.server.openInBrowser")).onClick(() => {
					if (!this.plugin.httpServer.isRunning) {
						new Notice(t("settings.server.notRunningNotice"));
						return;
					}
					const url = `http://127.0.0.1:${this.plugin.httpServer.actualPort}/?token=${this.plugin.tokenStore.get()}`;
					window.open(url);
				})
			);

		new Setting(containerEl)
			.setName(t("settings.server.regenerateToken"))
			.setDesc(t("settings.server.regenerateTokenDesc"))
			.addButton((btn) =>
				btn.setButtonText(t("settings.server.regenerateToken")).onClick(async () => {
					if (!window.confirm(t("settings.server.regenerateConfirm"))) return;
					await this.plugin.tokenStore.regenerate();
					new Notice(t("settings.server.regenerateDone"));
				})
			);

		new Setting(containerEl)
			.setName(t("settings.server.copyToken"))
			.setDesc(t("settings.server.copyTokenDesc"))
			.addButton((btn) =>
				btn.setButtonText(t("settings.server.copyToken")).onClick(async () => {
					const token = this.plugin.tokenStore.get();
					if (!token) {
						new Notice(t("settings.server.copyTokenEmpty"));
						return;
					}
					try {
						await navigator.clipboard.writeText(token);
						new Notice(t("settings.server.copyTokenDone"));
					} catch (e) {
						console.error("Personal OS: clipboard write failed", e);
						new Notice(t("E006"));
					}
				})
			);

		new Setting(containerEl).setName(t("settings.server.notifyOnStart")).addToggle((toggle) =>
			toggle.setValue(this.plugin.settings.server.notifyOnStart).onChange(async (value) => {
				this.plugin.settings.server.notifyOnStart = value;
				await this.save();
			})
		);
	}
}
