import { ItemView, type WorkspaceLeaf } from "obsidian";
import { mount, unmount, type Component as SvelteComponent } from "svelte";
import type PersonalOSPlugin from "../../main";
import { t } from "../../i18n/ja";
import Search from "./Search.svelte";

export const VIEW_TYPE_SEARCH = "pos-search";

export class SearchView extends ItemView {
	private component: ReturnType<typeof mount> | undefined;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: PersonalOSPlugin
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_SEARCH;
	}

	getDisplayText(): string {
		return t("search.title");
	}

	getIcon(): string {
		return "search";
	}

	async onOpen(): Promise<void> {
		this.component = mount(Search as SvelteComponent, {
			target: this.contentEl,
			props: { plugin: this.plugin },
		});
	}

	async onClose(): Promise<void> {
		if (this.component) await unmount(this.component);
	}
}
