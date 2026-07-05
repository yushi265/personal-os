import { MarkdownView, Notice, Platform, Plugin, TFile, type FileSystemAdapter, type WorkspaceLeaf } from "obsidian";
import type { EntityType } from "./domain/entity";
import type { Todo } from "./domain/todo";
import { today } from "./domain/date";
import { computeGoalLabelMigration } from "./domain/migrateGoals";
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
import { CommentService } from "./services/CommentService";
import { NoteService } from "./services/NoteService";
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
import { ManageView, VIEW_TYPE_MANAGE } from "./ui/manage/ManageView";
import { makeProjectDetailScreen, makeTicketDetailScreen, type ManageScreen } from "./ui/manage/manageNav";
import { EntitySwitcherModal } from "./ui/modals/EntitySwitcherModal";
import { statusBarTodoTitle, serverStartedNotice, serverStartFailedNotice, migrateGoalsToLabelsNotice, t } from "./i18n/ja";
import { TokenStore } from "./server/TokenStore";
import { AuthGuard } from "./server/AuthGuard";
import { HttpServer } from "./server/HttpServer";
import { SseHub } from "./server/SseHub";

const STATUSBAR_REFRESH_DEBOUNCE_MS = 100;

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
	commentService!: CommentService;
	noteService!: NoteService;
	progressService!: ProgressService;
	activityLogService!: ActivityLogService;
	promoteService!: PromoteService;
	searchService!: SearchService;
	savedViewService!: SavedViewService;
	reviewService!: ReviewService;
	exportService!: ExportService;
	tokenStore!: TokenStore;
	authGuard!: AuthGuard;
	httpServer!: HttpServer;
	sseHub!: SseHub;
	capability: Capability = { todoFeatures: false };
	private capabilityDetected = false;
	private statusBarEl: HTMLElement | undefined;
	private statusBarDebounceTimer: number | undefined;

	async onload() {
		await this.loadSettings();

		this.eventBus = new POSEventBus();
		this.selfWriteGuard = new SelfWriteGuard();
		this.repo = new VaultRepository(this.app, this.settings);
		this.store = new IndexStore();
		this.dataviewAdapter = new DataviewAdapter(this.app, this.store);
		this.tasksAdapter = new TasksAdapter(this.app);
		this.progressService = new ProgressService(this.repo, this.store, this.selfWriteGuard);
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
			this.progressService,
			this.eventBus
		);
		this.entityFieldService = new EntityFieldService(this.repo, this.store, this.activityLogService);
		this.todoService = new TodoService(this.repo, this.store, this.settings, this.indexer);
		this.commentService = new CommentService(this.repo);
		this.noteService = new NoteService(this.repo);
		this.promoteService = new PromoteService(this.repo, this.store, this.entityService, this.activityLogService);
		this.searchService = new SearchService(this.store, this.repo);
		this.savedViewService = new SavedViewService(this.settings, () => this.saveSettings());
		this.reviewService = new ReviewService(this.repo, this.store, this.activityLogService);
		this.exportService = new ExportService(this.store);
		this.tokenStore = new TokenStore(this.settings, () => this.saveSettings());
		this.authGuard = new AuthGuard(
			() => this.tokenStore.get(),
			() => this.httpServer.actualPort
		);
		this.httpServer = new HttpServer();
		this.sseHub = new SseHub(this.eventBus);

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
			if (!Platform.isMobile) this.setupStatusBar();
			this.registerEvent(this.eventBus.onEvent("settings-updated", () => void this.syncServerState()));
			await this.syncServerState();
		});
	}

	onunload() {
		// Viewはdetachせず放置(Obsidian推奨)。イベントはregisterEventで自動解除される。
		if (this.statusBarDebounceTimer !== undefined) window.clearTimeout(this.statusBarDebounceTimer);
		void this.httpServer?.stop();
	}

	/**
	 * ブラウザUIサーバーの状態を settings.server.enabled に合わせる(design-browser-ui.md §4.3)。
	 * 初回起動時に加え、設定画面での変更(settings-updated)のたびに呼ばれる。既に希望ポートで起動中なら
	 * 何もしない(無関係な設定変更のたびに再起動して既存接続を切らないため)。
	 */
	private async syncServerState(): Promise<void> {
		if (!Platform.isDesktopApp) return;

		if (!this.settings.server.enabled) {
			if (this.httpServer.isRunning) await this.httpServer.stop();
			return;
		}

		if (this.httpServer.isRunning && this.httpServer.actualPort === this.settings.server.port) return;

		await this.tokenStore.ensureToken();
		try {
			const port = await this.httpServer.start(this.settings.server.port, this.authGuard, {
				getVaultName: () => this.app.vault.getName(),
				getCapability: () => this.capability,
				getPort: () => this.httpServer.actualPort,
				store: this.store,
				entityService: this.entityService,
				entityFieldService: this.entityFieldService,
				todoService: this.todoService,
				commentService: this.commentService,
				noteService: this.noteService,
				promoteService: this.promoteService,
				sseHub: this.sseHub,
				getWebappDistDir: () => this.getWebappDistDir(),
			});
			if (port === -1) return;
			console.log(`Personal OS: browser UI server listening on http://127.0.0.1:${port}`);
			if (this.settings.server.notifyOnStart) {
				new Notice(serverStartedNotice(`http://127.0.0.1:${port}/?token=${this.tokenStore.get()}`));
			}
		} catch (err) {
			console.error("Personal OS: failed to start browser UI server", err);
			new Notice(serverStartFailedNotice(err instanceof Error ? err.message : String(err)));
		}
	}

	/** webapp-dist/ の絶対パス(design-browser-ui.md §3.4)。プラグインディレクトリ配下に同梱・ビルド時コピーされる */
	private getWebappDistDir(): string {
		const adapter = this.app.vault.adapter as FileSystemAdapter;
		const pluginDir = this.manifest.dir ?? `.obsidian/plugins/${this.manifest.id}`;
		return `${adapter.getBasePath()}/${pluginDir}/webapp-dist`;
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
		this.registerView(VIEW_TYPE_MANAGE, (leaf) => new ManageView(leaf, this));
	}

	private registerCommands(): void {
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
			id: "open-manage",
			name: t("command.openManage"),
			callback: () => this.openManage(),
		});
		this.addCommand({
			id: "open-entity-switcher",
			name: t("command.openEntitySwitcher"),
			callback: () => this.openEntitySwitcher(),
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
		this.addCommand({
			id: "migrate-goals-to-labels",
			name: t("command.migrateGoalsToLabels"),
			callback: () => void this.migrateGoalsToLabels(),
		});
	}

	/**
	 * Goal概念廃止(design-remove-goal.md G1)の移行コマンド。
	 * ① 全project(archived含む)のgoalをlabelsへ変換しgoalキーを削除
	 * ② 全goalノートをstatus: archivedにしてArchive/へ移動
	 * 冪等: ①は移行済み(goalキーが既に無い)projectは対象に入らない。②は既にArchive/配下かつstatus: archivedのgoalをスキップする
	 */
	private async migrateGoalsToLabels(): Promise<void> {
		let migratedProjects = 0;
		let archivedGoals = 0;

		for (const project of this.store.listByType("project")) {
			if (!project.goal) continue;
			try {
				const result = computeGoalLabelMigration(
					{ path: project.path, labels: project.labels, goalRaw: project.goal },
					(path) => this.store.get(path)?.title
				);
				await this.repo.updateFrontmatter(project.path, (fm) => {
					fm.labels = result.labels;
					delete fm.goal;
				});
				migratedProjects++;
			} catch (err) {
				console.error(`Personal OS: goal→labels移行に失敗(project): ${project.path}`, err);
			}
		}

		const archiveFolderPrefix = `${this.settings.rootDirectory}/${this.settings.folders.archive}/`;
		for (const goal of this.store.listByType("goal")) {
			try {
				const alreadyInArchive = goal.path.startsWith(archiveFolderPrefix);
				if (goal.status === "archived" && alreadyInArchive) continue;
				if (goal.status !== "archived") {
					await this.entityService.archive(goal.path);
				} else {
					await this.repo.moveToArchive(goal.path);
				}
				archivedGoals++;
			} catch (err) {
				console.error(`Personal OS: Goalのアーカイブに失敗: ${goal.path}`, err);
			}
		}

		if (this.activityLogService) {
			await this.activityLogService.log("update", migrateGoalsToLabelsNotice(migratedProjects, archivedGoals));
		}
		new Notice(migrateGoalsToLabelsNotice(migratedProjects, archivedGoals));
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

	/** DashboardのオンボーディングWelcomeカード(Phase U3)等、View外からも管理Viewを開けるようpublicにする */
	async openManage(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_MANAGE);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: VIEW_TYPE_MANAGE, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	/** 外部(Dashboard等)からManage Viewの特定画面へ遷移する(design-drilldown-nav.md §2.5)。未オープン時は開いてから遷移する */
	async openManageAt(screen: ManageScreen): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_MANAGE);
		let leaf: WorkspaceLeaf;
		if (existing.length > 0) {
			leaf = existing[0];
		} else {
			leaf = this.app.workspace.getLeaf(true);
			await leaf.setViewState({ type: VIEW_TYPE_MANAGE, active: true });
		}
		this.app.workspace.revealLeaf(leaf);
		if (leaf.view instanceof ManageView) leaf.view.navigateTo(screen);
	}

	/** エンティティ版クイックスイッチャー(Phase U2)。project/ticketいずれも管理Viewの詳細画面へ遷移する */
	openEntitySwitcher(): void {
		new EntitySwitcherModal(this.app, {
			store: this.store,
			onChooseProject: (path) => void this.openManageAt(makeProjectDetailScreen(path)),
			onChooseTicket: (path) => void this.openManageAt(makeTicketDetailScreen(path)),
		}).open();
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

	/**
	 * ステータスバー(Phase U3): 今日以前の未完了Todo件数を表示する(TodayTodoWidget/Dashboardと同じ判定=dueOn:today())。
	 * Platform.isMobileでは呼ばれない(モバイルにステータスバーが無いため)。capability.todoFeatures無効時は非表示にする。
	 */
	private setupStatusBar(): void {
		this.statusBarEl = this.addStatusBarItem();
		this.statusBarEl.addClass("pos-statusbar-item");
		this.registerDomEvent(this.statusBarEl, "click", () => void this.openDashboard());
		this.registerEvent(this.eventBus.onEvent("index-updated", () => this.scheduleStatusBarRefresh()));
		this.registerEvent(this.eventBus.onEvent("capability-changed", () => this.scheduleStatusBarRefresh()));
		this.updateStatusBar();
	}

	private scheduleStatusBarRefresh(): void {
		if (this.statusBarDebounceTimer !== undefined) window.clearTimeout(this.statusBarDebounceTimer);
		this.statusBarDebounceTimer = window.setTimeout(() => {
			this.statusBarDebounceTimer = undefined;
			this.updateStatusBar();
		}, STATUSBAR_REFRESH_DEBOUNCE_MS);
	}

	private updateStatusBar(): void {
		if (!this.statusBarEl) return;
		if (!this.capability.todoFeatures) {
			this.statusBarEl.hide();
			return;
		}
		const count = this.todoService.list({ done: false, dueOn: today() }).length;
		this.statusBarEl.show();
		this.statusBarEl.setText(`☑ ${count}`);
		this.statusBarEl.setAttribute("title", statusBarTodoTitle(count));
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
		this.registerDataviewMetadataChange();
	}

	/**
	 * Dataviewは自身のpage/taskインデックスをmetadataCacheの"changed"より遅れて再構築するため、
	 * Todo追記直後にreindexFileしてもDataviewAdapter.getTodos()が古いtasksを返すことがある(design-ui-first.md起因のバグ)。
	 * Dataviewが該当ファイルの再インデックスを終えた通知("dataview:metadata-change")を購読し、そのタイミングで
	 * 改めてreindexFileすることで最終的に正しいTodo一覧へ収束させる。
	 */
	private registerDataviewMetadataChange(): void {
		const metadataCache = this.app.metadataCache as unknown as {
			on(name: string, cb: (...args: unknown[]) => void): { name: string; callback: (...args: unknown[]) => void };
			offref(ref: unknown): void;
		};
		const ref = metadataCache.on("dataview:metadata-change", (...args: unknown[]) => {
			const file = args[1];
			if (file instanceof TFile && this.repo.isUnderRoot(file.path)) {
				void this.indexer.reindexFile(file);
			}
		});
		this.register(() => metadataCache.offref(ref));
	}
}
