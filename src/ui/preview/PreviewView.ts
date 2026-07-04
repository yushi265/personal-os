import { ItemView, TFile, type WorkspaceLeaf } from "obsidian";
import { mount, unmount, type Component as SvelteComponent } from "svelte";
import { writable, type Writable } from "svelte/store";
import type PersonalOSPlugin from "../../main";
import { t } from "../../i18n/ja";
import Preview from "./Preview.svelte";
import { bodyPreviewLines, EMPTY_PREVIEW_DATA, resolveParseError, type PreviewData } from "./previewData";

export const VIEW_TYPE_PREVIEW = "pos-preview";
export type { PreviewData } from "./previewData";

export class PreviewView extends ItemView {
	private component: ReturnType<typeof mount> | undefined;
	private dataStore: Writable<PreviewData> = writable(EMPTY_PREVIEW_DATA);

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
		this.registerEvent(this.plugin.eventBus.onEvent("capability-changed", () => this.refresh()));

		this.refresh();
	}

	async onClose(): Promise<void> {
		if (this.component) await unmount(this.component);
	}

	private refresh(): void {
		void this.buildData().then((data) => this.dataStore.set(data));
	}

	private async buildData(): Promise<PreviewData> {
		const file = this.app.workspace.getActiveFile();
		if (!(file instanceof TFile)) return EMPTY_PREVIEW_DATA;

		const entity = this.plugin.store.get(file.path);
		if (!entity) {
			const parseError = resolveParseError(this.plugin.store.getParseErrors(), file.path);
			return { ...EMPTY_PREVIEW_DATA, path: file.path, parseError };
		}

		const raw = await this.plugin.repo.readBody(entity.path);
		return {
			entity,
			children: this.plugin.store.getChildren(entity.path),
			todos: this.plugin.store.getTodos(entity.path),
			bodyLines: bodyPreviewLines(raw),
			path: entity.path,
		};
	}
}
