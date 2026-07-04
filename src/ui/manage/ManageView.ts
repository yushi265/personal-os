import { ItemView, type WorkspaceLeaf } from "obsidian";
import { mount, unmount, type Component as SvelteComponent } from "svelte";
import { writable, type Writable } from "svelte/store";
import type PersonalOSPlugin from "../../main";
import { t } from "../../i18n/ja";
import Manage from "./Manage.svelte";
import type { ManageScreen } from "./manageNav";

export const VIEW_TYPE_MANAGE = "pos-manage";

const REFRESH_DEBOUNCE_MS = 100;

export interface ManageRefreshToken {
	token: number;
	/** このデバウンス窓内に蓄積されたrename([oldPath, newPath])。reconcileStack(manageNav.ts)へそのまま渡す */
	renames: Array<[string, string]>;
}

export class ManageView extends ItemView {
	private component: ReturnType<typeof mount> | undefined;
	/** index-updated等の変更を検知するためのトリガ。rename情報を捨てずに蓄積し、reconcileStackへ渡す(design-drilldown-nav.md §2.4) */
	private refreshToken: Writable<ManageRefreshToken> = writable({ token: 0, renames: [] });
	private pendingRenames: Array<[string, string]> = [];
	private debounceTimer: number | undefined;

	/** 外部(Dashboard等)からの遷移リクエスト(§2.5)。onOpenより前に呼ばれても保持されるようクラスフィールドとして初期化する */
	private navigateRequest: Writable<{ token: number; screen: ManageScreen } | null> = writable(null);
	private navToken = 0;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: PersonalOSPlugin
	) {
		super(leaf);
	}

	/** 外部(Dashboard等)から呼ぶ。開いていなければmain.ts側のopenManageAt()が開いてから呼び出す想定 */
	navigateTo(screen: ManageScreen): void {
		this.navigateRequest.set({ token: ++this.navToken, screen });
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
				navigateRequest: this.navigateRequest,
			},
		});

		this.registerEvent(
			this.plugin.eventBus.onEvent("index-updated", (payload) => {
				if (Array.isArray(payload) && payload.length === 2) this.pendingRenames.push(payload as [string, string]);
				this.scheduleRefresh();
			})
		);
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
			const renames = this.pendingRenames;
			this.pendingRenames = [];
			this.refreshToken.update((s) => ({ token: s.token + 1, renames }));
		}, REFRESH_DEBOUNCE_MS);
	}
}
