import { Notice, Plugin, TFile } from "obsidian";
import type { EntityType } from "./domain/entity";
import { DEFAULT_SETTINGS, type POSSettings } from "./settings/settings";
import { POSSettingsTab } from "./settings/SettingsTab";
import { POSEventBus } from "./infra/EventBus";
import { SelfWriteGuard } from "./infra/SelfWriteGuard";
import { VaultRepository } from "./infra/VaultRepository";
import { IndexStore } from "./infra/IndexStore";
import { Indexer } from "./infra/Indexer";
import { DataviewAdapter } from "./infra/DataviewAdapter";
import { TasksAdapter } from "./infra/TasksAdapter";
import { EntityService } from "./services/EntityService";
import { TodoService } from "./services/TodoService";
import { CreateEntityModal } from "./ui/modals/CreateEntityModal";
import { QuickAddModal } from "./ui/modals/QuickAddModal";
import { t } from "./i18n/ja";

interface Capability {
	todoFeatures: boolean;
}

export default class PersonalOSPlugin extends Plugin {
	declare settings: POSSettings;
	eventBus!: POSEventBus;
	repo!: VaultRepository;
	store!: IndexStore;
	selfWriteGuard!: SelfWriteGuard;
	indexer!: Indexer;
	dataviewAdapter!: DataviewAdapter;
	tasksAdapter!: TasksAdapter;
	entityService!: EntityService;
	todoService!: TodoService;
	capability: Capability = { todoFeatures: false };

	async onload() {
		await this.loadSettings();

		this.eventBus = new POSEventBus();
		this.selfWriteGuard = new SelfWriteGuard();
		this.repo = new VaultRepository(this.app, this.settings, this.selfWriteGuard);
		this.store = new IndexStore();
		this.dataviewAdapter = new DataviewAdapter(this.app, this.store);
		this.tasksAdapter = new TasksAdapter(this.app);
		this.indexer = new Indexer(
			this.app,
			this.repo,
			this.store,
			this.eventBus,
			this.selfWriteGuard,
			this.dataviewAdapter
		);
		// ActivityLogService/ProgressServiceはPhase 3/4で追加し、EntityServiceへ注入する。
		this.entityService = new EntityService(this.repo, this.store, this.settings);
		this.todoService = new TodoService(this.repo, this.store, this.settings, this.indexer);

		this.registerViews();
		this.registerCommands();
		this.addSettingTab(new POSSettingsTab(this.app, this));
		this.addRibbonIcon("layout-dashboard", t("ribbon.openDashboard"), () => this.openDashboard());

		this.app.workspace.onLayoutReady(async () => {
			this.detectCapability();
			await this.waitDataviewReady();
			await this.indexer.fullScan();
			this.registerVaultEvents();
		});
	}

	onunload() {
		// Viewはdetachせず放置(Obsidian推奨)。イベントはregisterEventで自動解除される。
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private registerViews(): void {
		// Dashboard/Kanban/Preview/Timeline Viewの登録場所(Phase 3〜5で追加)
	}

	private registerCommands(): void {
		this.addCommand({
			id: "create-goal",
			name: t("command.createGoal"),
			callback: () => this.openCreateModal("goal"),
		});
		this.addCommand({
			id: "create-project",
			name: t("command.createProject"),
			callback: () => this.openCreateModal("project"),
		});
		this.addCommand({
			id: "create-ticket",
			name: t("command.createTicket"),
			callback: () => this.openCreateModal("ticket"),
		});
		this.addCommand({
			id: "create-todo",
			name: t("command.createTodo"),
			checkCallback: (checking) => {
				if (!this.capability.todoFeatures) return false;
				if (!checking) this.openQuickAddModal();
				return true;
			},
		});
		this.addCommand({
			id: "open-dashboard",
			name: t("command.openDashboard"),
			callback: () => this.openDashboard(),
		});
		this.addCommand({
			id: "refresh-index",
			name: t("command.refreshIndex"),
			callback: () => void this.indexer.fullScan(),
		});
	}

	private openCreateModal(type: EntityType): void {
		new CreateEntityModal(this.app, {
			entityService: this.entityService,
			store: this.store,
			settings: this.settings,
			initialType: type,
		}).open();
	}

	private openDashboard(): void {
		new Notice(t("notice.dashboardPlaceholder"));
	}

	private openQuickAddModal(): void {
		new QuickAddModal(this.app, {
			todoService: this.todoService,
			store: this.store,
			settings: this.settings,
		}).open();
	}

	private detectCapability(): void {
		this.capability = { todoFeatures: this.dataviewAdapter.available && this.tasksAdapter.available };
		this.eventBus.emitEvent("capability-changed", this.capability);
		if (!this.capability.todoFeatures) {
			new Notice(t("E001"));
		}
	}

	private async waitDataviewReady(): Promise<void> {
		const plugins = (this.app as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins.plugins;
		if (!plugins["dataview"]) return;

		await new Promise<void>((resolve) => {
			let settled = false;
			const finish = () => {
				if (settled) return;
				settled = true;
				resolve();
			};
			const metadataCache = this.app.metadataCache as unknown as {
				on(name: string, cb: () => void): { name: string; callback: () => void };
				offref(ref: unknown): void;
			};
			const ref = metadataCache.on("dataview:index-ready", finish);
			this.register(() => metadataCache.offref(ref));
			setTimeout(finish, 5000);
		});
	}

	private registerVaultEvents(): void {
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (!this.repo.isUnderRoot(file.path)) return;
				void this.indexer.reindexFile(file);
			})
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile) void this.indexer.handleRename(file, oldPath);
			})
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile) this.indexer.handleDelete(file);
			})
		);
	}
}
