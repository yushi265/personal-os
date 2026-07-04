import { ItemView, type WorkspaceLeaf } from "obsidian";
import { mount, unmount, type Component as SvelteComponent } from "svelte";
import { writable, type Writable } from "svelte/store";
import type PersonalOSPlugin from "../../main";
import { t } from "../../i18n/ja";
import Kanban from "./Kanban.svelte";
import { buildKanbanData, EMPTY_KANBAN_DATA, type KanbanData, type KanbanMode } from "./kanbanData";

export const VIEW_TYPE_KANBAN = "pos-kanban";

const REFRESH_DEBOUNCE_MS = 100;

export class KanbanView extends ItemView {
	private component: ReturnType<typeof mount> | undefined;
	private mode: KanbanMode = "ticket";
	private dataStore: Writable<KanbanData> = writable(EMPTY_KANBAN_DATA);
	private debounceTimer: number | undefined;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: PersonalOSPlugin
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_KANBAN;
	}

	getDisplayText(): string {
		return t("kanban.title");
	}

	getIcon(): string {
		return "layout-columns";
	}

	async onOpen(): Promise<void> {
		this.component = mount(Kanban as SvelteComponent, {
			target: this.contentEl,
			props: {
				plugin: this.plugin,
				data: this.dataStore,
				onRefresh: () => this.refresh(),
				onModeChange: (mode: KanbanMode) => {
					this.mode = mode;
					this.refresh();
				},
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
		this.dataStore.set(buildKanbanData(this.plugin, this.mode));
	}
}
