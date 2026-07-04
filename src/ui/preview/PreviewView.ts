import { ItemView, TFile, type WorkspaceLeaf } from "obsidian";
import { mount, unmount, type Component as SvelteComponent } from "svelte";
import { writable, type Writable } from "svelte/store";
import type PersonalOSPlugin from "../../main";
import type { Entity } from "../../domain/entity";
import type { Todo } from "../../domain/todo";
import { t } from "../../i18n/ja";
import Preview from "./Preview.svelte";

export const VIEW_TYPE_PREVIEW = "pos-preview";

export interface PreviewData {
	entity: Entity | null;
	children: Entity[];
	todos: Todo[];
}

const EMPTY_DATA: PreviewData = { entity: null, children: [], todos: [] };

export class PreviewView extends ItemView {
	private component: ReturnType<typeof mount> | undefined;
	private dataStore: Writable<PreviewData> = writable(EMPTY_DATA);

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: PersonalOSPlugin
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PREVIEW;
	}

	getDisplayText(): string {
		return t("preview.title");
	}

	getIcon(): string {
		return "eye";
	}

	async onOpen(): Promise<void> {
		this.component = mount(Preview as SvelteComponent, {
			target: this.contentEl,
			props: { plugin: this.plugin, data: this.dataStore },
		});

		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refresh()));
		this.registerEvent(this.plugin.eventBus.onEvent("index-updated", () => this.refresh()));

		this.refresh();
	}

	async onClose(): Promise<void> {
		if (this.component) await unmount(this.component);
	}

	private refresh(): void {
		this.dataStore.set(this.buildData());
	}

	private buildData(): PreviewData {
		const file = this.app.workspace.getActiveFile();
		if (!(file instanceof TFile)) return EMPTY_DATA;

		const entity = this.plugin.store.get(file.path);
		if (!entity) return EMPTY_DATA;

		return {
			entity,
			children: this.plugin.store.getChildren(entity.path),
			todos: this.plugin.store.getTodos(entity.path),
		};
	}
}
