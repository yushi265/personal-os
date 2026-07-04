import type { POSSettings, SavedView } from "../settings/settings";

/**
 * Saved Views(design.md §7 / detail-design.md §4.7)。
 * クエリは原文で保存し、data.json(settings.savedViews)へ永続化する。
 */
export class SavedViewService {
	constructor(
		private settings: POSSettings,
		private saveSettings: () => Promise<void>
	) {}

	list(): SavedView[] {
		return this.settings.savedViews;
	}

	async save(input: Omit<SavedView, "id">): Promise<SavedView> {
		const view: SavedView = { id: crypto.randomUUID(), ...input };
		this.settings.savedViews.push(view);
		await this.saveSettings();
		return view;
	}

	async update(id: string, patch: Partial<Omit<SavedView, "id">>): Promise<void> {
		const view = this.settings.savedViews.find((v) => v.id === id);
		if (!view) return;
		Object.assign(view, patch);
		await this.saveSettings();
	}

	async remove(id: string): Promise<void> {
		this.settings.savedViews = this.settings.savedViews.filter((v) => v.id !== id);
		await this.saveSettings();
	}
}
