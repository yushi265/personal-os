import { ItemView, type WorkspaceLeaf } from "obsidian";
import { mount, unmount, type Component as SvelteComponent } from "svelte";
import { writable, type Writable } from "svelte/store";
import type PersonalOSPlugin from "../../main";
import { t } from "../../i18n/ja";
import Timeline from "./Timeline.svelte";
import { buildTimelineData, EMPTY_TIMELINE_DATA, type TimelineData } from "./timelineData";

export const VIEW_TYPE_TIMELINE = "pos-timeline";

const REFRESH_DEBOUNCE_MS = 100;

export class TimelineView extends ItemView {
	private component: ReturnType<typeof mount> | undefined;
	private dataStore: Writable<TimelineData> = writable(EMPTY_TIMELINE_DATA);
	private debounceTimer: number | undefined;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: PersonalOSPlugin
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_TIMELINE;
	}

	getDisplayText(): string {
		return t("timeline.title");
	}

	getIcon(): string {
		return "gantt-chart";
	}

	async onOpen(): Promise<void> {
		this.component = mount(Timeline as SvelteComponent, {
			target: this.contentEl,
			props: {
				plugin: this.plugin,
				data: this.dataStore,
				onRefresh: () => this.refresh(),
			},
		});

		this.registerEvent(this.plugin.eventBus.onEvent("index-updated", () => this.scheduleRefresh()));

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
		this.dataStore.set(buildTimelineData(this.plugin));
	}
}
