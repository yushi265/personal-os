import { ItemView, type WorkspaceLeaf } from "obsidian";
import { mount, unmount, type Component as SvelteComponent } from "svelte";
import { writable, type Writable } from "svelte/store";
import type PersonalOSPlugin from "../../main";
import { t } from "../../i18n/ja";
import Manage from "./Manage.svelte";

export const VIEW_TYPE_MANAGE = "pos-manage";

const REFRESH_DEBOUNCE_MS = 100;

export class ManageView extends ItemView {
	private component: ReturnType<typeof mount> | undefined;
	/** index-updated等の変更を検知するためのトリガ(値そのものに意味はなく、変化したことのみをManage.svelteの$derivedへ伝える) */
	private refreshToken: Writable<number> = writable(0);
	private debounceTimer: number | undefined;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: PersonalOSPlugin
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_MANAGE;
	}

	getDisplayText(): string {
		return t("manage.title");
	}

	getIcon(): string {
		return "table";
	}

	async onOpen(): Promise<void> {
		this.component = mount(Manage as SvelteComponent, {
			target: this.contentEl,
			props: {
				plugin: this.plugin,
				refreshToken: this.refreshToken,
			},
		});

		this.registerEvent(this.plugin.eventBus.onEvent("index-updated", () => this.scheduleRefresh()));
		this.registerEvent(this.plugin.eventBus.onEvent("settings-updated", () => this.scheduleRefresh()));
		this.registerEvent(this.plugin.eventBus.onEvent("capability-changed", () => this.scheduleRefresh()));
	}

	async onClose(): Promise<void> {
		if (this.debounceTimer !== undefined) window.clearTimeout(this.debounceTimer);
		if (this.component) await unmount(this.component);
	}

	private scheduleRefresh(): void {
		if (this.debounceTimer !== undefined) window.clearTimeout(this.debounceTimer);
		this.debounceTimer = window.setTimeout(() => {
			this.debounceTimer = undefined;
			this.refreshToken.update((n) => n + 1);
		}, REFRESH_DEBOUNCE_MS);
	}
}
