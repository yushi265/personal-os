import { ItemView, type WorkspaceLeaf } from "obsidian";
import { mount, unmount, type Component as SvelteComponent } from "svelte";
import { writable, type Writable } from "svelte/store";
import type PersonalOSPlugin from "../../main";
import { t } from "../../i18n/ja";
import Dashboard from "./Dashboard.svelte";
import { buildDashboardData, type DashboardData } from "./dashboardData";

export const VIEW_TYPE_DASHBOARD = "pos-dashboard";

const REFRESH_DEBOUNCE_MS = 100;

const EMPTY_DATA: DashboardData = {
	todoFeatures: false,
	isEmpty: false,
	todayTodos: [],
	overdueTodos: [],
	overdueEntities: [],
	openTodosCount: 0,
	activeGoals: [],
	activeProjects: [],
	activeTickets: [],
	reviewNeeded: [],
	blocked: [],
	recentUpdates: [],
	activityLogLines: [],
	parseErrors: [],
};

export class DashboardView extends ItemView {
	private component: ReturnType<typeof mount> | undefined;
	private dataStore: Writable<DashboardData> = writable(EMPTY_DATA);
	private debounceTimer: number | undefined;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: PersonalOSPlugin
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_DASHBOARD;
	}

	getDisplayText(): string {
		return t("dashboard.title");
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	async onOpen(): Promise<void> {
		this.component = mount(Dashboard as SvelteComponent, {
			target: this.contentEl,
			props: {
				plugin: this.plugin,
				data: this.dataStore,
				onRefresh: () => this.refresh(),
			},
		});

		this.registerEvent(this.plugin.eventBus.onEvent("index-updated", () => this.scheduleRefresh()));
		this.registerEvent(this.plugin.eventBus.onEvent("settings-updated", () => this.scheduleRefresh()));

		this.refresh();
	}

	async onClose(): Promise<void> {
		if (this.debounceTimer !== undefined) window.clearTimeout(this.debounceTimer);
		if (this.component) await unmount(this.component);
	}

	private scheduleRefresh(): void {
		if (this.debounceTimer !== undefined) window.clearTimeout(this.debounceTimer);
		this.debounceTimer = window.setTimeout(() => {
			this.debounceTimer = undefined;
			this.refresh();
		}, REFRESH_DEBOUNCE_MS);
	}

	private refresh(): void {
		void buildDashboardData(this.plugin).then((data) => this.dataStore.set(data));
	}
}
