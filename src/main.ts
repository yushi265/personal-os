import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import type { EntityType } from "./domain/entity";
import type { Todo } from "./domain/todo";
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
import { EntityFieldService } from "./services/EntityFieldService";
import { TodoService } from "./services/TodoService";
import { ProgressService } from "./services/ProgressService";
import { ActivityLogService } from "./services/ActivityLogService";
import { PromoteService } from "./services/PromoteService";
import { SearchService } from "./services/SearchService";
import { SavedViewService } from "./services/SavedViewService";
import { ReviewService } from "./services/ReviewService";
import { ExportService } from "./services/ExportService";
import { CreateEntityModal } from "./ui/modals/CreateEntityModal";
import { QuickAddModal } from "./ui/modals/QuickAddModal";
import { PromoteTicketModal, PromoteTodoModal } from "./ui/modals/PromoteModal";
import { ReviewModal } from "./ui/modals/ReviewModal";
import { DashboardView, VIEW_TYPE_DASHBOARD } from "./ui/dashboard/DashboardView";
import { PreviewView, VIEW_TYPE_PREVIEW } from "./ui/preview/PreviewView";
import { KanbanView, VIEW_TYPE_KANBAN } from "./ui/kanban/KanbanView";
import { SearchView, VIEW_TYPE_SEARCH } from "./ui/search/SearchView";
import { TimelineView, VIEW_TYPE_TIMELINE } from "./ui/timeline/TimelineView";
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
	entityFieldService!: EntityFieldService;
	todoService!: TodoService;
	progressService!: ProgressService;
	activityLogService!: ActivityLogService;
	promoteService!: PromoteService;
	searchService!: SearchService;
	savedViewService!: SavedViewService;
	reviewService!: ReviewService;
	exportService!: ExportService;
	capability: Capability = { todoFeatures: false };
	private capabilityDetected = false;

	async onload() {
		await this.loadSettings();

		this.eventBus = new POSEventBus();
		this.selfWriteGuard = new SelfWriteGuard();
		this.repo = new VaultRepository(this.app, this.settings, this.selfWriteGuard);
		this.store = new IndexStore();
		this.dataviewAdapter = new DataviewAdapter(this.app, this.store);
		this.tasksAdapter = new TasksAdapter(this.app);
		this.progressService = new ProgressService(this.repo, this.store);
		this.indexer = new Indexer(
			this.app,
			this.repo,
			this.store,
			this.eventBus,
			this.selfWriteGuard,
			this.dataviewAdapter,
			this.progressService
		);
		this.activityLogService = new ActivityLogService(this.repo, this.settings);
		this.entityService = new EntityService(
			this.repo,
			this.store,
			this.settings,
			this.activityLogService,
			this.progressService
		);
		this.entityFieldService = new EntityFieldService(this.repo, this.store, this.activityLogService);
		this.todoService = new TodoService(this.repo, this.store, this.settings, this.indexer);
		this.promoteService = new PromoteService(this.repo, this.store, this.entityService, this.activityLogService);
		this.searchService = new SearchService(this.store, this.repo);
		this.savedViewService = new SavedViewService(this.settings, () => this.saveSettings());
		this.reviewService = new ReviewService(this.repo, this.store, this.activityLogService);
		this.exportService = new ExportService(this.store);

		this.registerViews();
		this.registerCommands();
		this.addSettingTab(new POSSettingsTab(this.app, this));
		this.addRibbonIcon("layout-dashboard", t("ribbon.openDashboard"), () => this.openDashboard());

		this.app.workspace.onLayoutReady(async () => {
			this.refreshCapability();
			await this.waitDataviewReady();
			await this.indexer.fullScan();
			this.registerVaultEvents();
			await this.ensurePreviewLeaf();
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
		this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));
		this.registerView(VIEW_TYPE_PREVIEW, (leaf) => new PreviewView(leaf, this));
		this.registerView(VIEW_TYPE_KANBAN, (leaf) => new KanbanView(leaf, this));
		this.registerView(VIEW_TYPE_SEARCH, (leaf) => new SearchView(leaf, this));
		this.registerView(VIEW_TYPE_TIMELINE, (leaf) => new TimelineView(leaf, this));
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
			id: "open-kanban",
			name: t("command.openKanban"),
			callback: () => this.openKanban(),
		});
		this.addCommand({
			id: "refresh-index",
			name: t("command.refreshIndex"),
			callback: () => {
				this.refreshCapability();
				void this.indexer.fullScan();
			},
		});
		this.addCommand({
			id: "promote-todo",
			name: t("command.promoteTodo"),
			checkCallback: (checking) => {
				if (!this.capability.todoFeatures) return false;
				const todo = this.findTodoAtCursor();
				if (!todo) return false;
				if (!checking) this.openPromoteTodoModal(todo);
				return true;
			},
		});
		this.addCommand({
			id: "promote-ticket",
			name: t("command.promoteTicket"),
			checkCallback: (checking) => {
				const entity = this.activeEntity();
				if (!entity || entity.type !== "ticket") return false;
				if (!checking) this.openPromoteTicketModal(entity.path, entity.title);
				return true;
			},
		});
		this.addCommand({
			id: "archive-entity",
			name: t("command.archiveEntity"),
			checkCallback: (checking) => {
				const entity = this.activeEntity();
				if (!entity) return false;
				if (!checking) void this.entityService.archive(entity.path);
				return true;
			},
		});
		this.addCommand({
			id: "open-review",
			name: t("command.openReview"),
			checkCallback: (checking) => {
				const entity = this.activeEntity();
				if (!entity || (entity.type !== "project" && entity.type !== "goal")) return false;
				if (!checking) this.openReviewModal(entity.path);
				return true;
			},
		});
		this.addCommand({
			id: "open-search",
			name: t("command.openSearch"),
			callback: () => this.openSearch(),
		});
		this.addCommand({
			id: "open-timeline",
			name: t("command.openTimeline"),
			callback: () => this.openTimeline(),
		});
		this.addCommand({
			id: "export-ai-context",
			name: t("command.exportAiContext"),
			callback: () => void this.exportService.exportAiContext(),
		});
		this.addCommand({
			id: "export-ai-summary",
			name: t("command.exportAiSummary"),
			callback: () => void this.exportService.exportAiSummary(),
		});
	}

	private activeEntity() {
		const file = this.app.workspace.getActiveFile();
		if (!file) return undefined;
		return this.store.get(file.path);
	}

	private findTodoAtCursor(): Todo | undefined {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file) return undefined;
		const line = view.editor.getCursor().line;
		return this.store.getTodos(view.file.path).find((todo) => todo.line === line);
	}

	private openPromoteTodoModal(todo: Todo): void {
		new PromoteTodoModal(this.app, {
			promoteService: this.promoteService,
			store: this.store,
			todo,
			todoFeatures: this.capability.todoFeatures,
		}).open();
	}

	private openPromoteTicketModal(ticketPath: string, ticketTitle: string): void {
		new PromoteTicketModal(this.app, {
			promoteService: this.promoteService,
			ticketPath,
			ticketTitle,
		}).open();
	}

	private openReviewModal(targetPath: string): void {
		const target = this.store.get(targetPath);
		if (!target) return;
		new ReviewModal(this.app, {
			reviewService: this.reviewService,
			target,
			defaultCycle: this.settings.defaultReviewCycle,
		}).open();
	}

	private openCreateModal(type: EntityType): void {
		new CreateEntityModal(this.app, {
			entityService: this.entityService,
			store: this.store,
			settings: this.settings,
			initialType: type,
		}).open();
	}

	private async openDashboard(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	private async openKanban(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_KANBAN);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: VIEW_TYPE_KANBAN, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	private async openSearch(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SEARCH);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: VIEW_TYPE_SEARCH, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	private async openTimeline(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: VIEW_TYPE_TIMELINE, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	private async ensurePreviewLeaf(): Promise<void> {
		if (this.app.workspace.getLeavesOfType(VIEW_TYPE_PREVIEW).length > 0) return;
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_PREVIEW, active: false });
	}

	private openQuickAddModal(): void {
		new QuickAddModal(this.app, {
			todoService: this.todoService,
			store: this.store,
			settings: this.settings,
			todoFeatures: this.capability.todoFeatures,
		}).open();
	}

	/**
	 * 依存プラグイン(Dataview/Tasks)の有効化状態を再検出する。
	 * 初回起動時に加え、設定画面を開いたタイミング・Refresh Indexコマンド実行時にも呼ばれる(detail-design.md §8.1)。
	 * 状態が変化した場合のみ capability-changed を発火し、Dashboardのバナー表示等を更新させる。
	 */
	refreshCapability(): void {
		const next = { todoFeatures: this.dataviewAdapter.available && this.tasksAdapter.available };
		const changed = !this.capabilityDetected || next.todoFeatures !== this.capability.todoFeatures;
		this.capability = next;
		this.capabilityDetected = true;
		if (!changed) return;
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
