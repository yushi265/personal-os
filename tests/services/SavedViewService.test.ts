import { describe, expect, it } from "vitest";
import { SavedViewService } from "../../src/services/SavedViewService";
import { DEFAULT_SETTINGS, type POSSettings, type SavedView } from "../../src/settings/settings";

/**
 * design-ui-first.md §7.5 SavedView後方互換テスト(S-1〜S-4)。
 * data.jsonはJSON.parse経由でTypeScriptの型チェックを経由しないため、
 * ここでは「旧形式のプレーンオブジェクトをそのままsettings.savedViewsへ入れても壊れない」ことを確認する。
 */
function makeSettings(savedViews: unknown[]): POSSettings {
	return { ...DEFAULT_SETTINGS, savedViews: savedViews as SavedView[] };
}

describe("SavedView backward compatibility", () => {
	it("S-1: a pre-A3 list view (no tab field) loads with tab undefined", () => {
		const legacy = { id: "1", name: "old-list", query: "status:doing", sort: { key: "title", order: "asc" }, viewMode: "list" };
		const settings = makeSettings([legacy]);
		const service = new SavedViewService(settings, async () => undefined);

		const [view] = service.list();

		expect(view.viewMode).toBe("list");
		expect(view.tab).toBeUndefined();
	});

	it("S-2: a pre-A3 kanban view is unaffected by the SavedView type extension", () => {
		const legacy = { id: "2", name: "old-kanban", query: "type:ticket", sort: { key: "due", order: "desc" }, viewMode: "kanban" };
		const settings = makeSettings([legacy]);
		const service = new SavedViewService(settings, async () => undefined);

		const [view] = service.list();

		expect(view.viewMode).toBe("kanban");
	});

	it("S-3: a new manage view round-trips with its tab", () => {
		const settings = makeSettings([]);
		const service = new SavedViewService(settings, async () => undefined);

		return service
			.save({ name: "my-tickets", query: "status:doing", sort: { key: "priority", order: "asc" }, viewMode: "manage", tab: "ticket" })
			.then(() => {
				const [view] = service.list();
				expect(view.viewMode).toBe("manage");
				expect(view.tab).toBe("ticket");
			});
	});

	it("S-4: a manage view saved without a tab (e.g. hand-edited data.json) falls back to 'project' at the call site", () => {
		const legacy = { id: "4", name: "broken-manage", query: "", sort: { key: "title", order: "asc" }, viewMode: "manage" };
		const settings = makeSettings([legacy]);
		const service = new SavedViewService(settings, async () => undefined);

		const [view] = service.list();
		// SavedViewService自体はデフォルト補完を行わない(design §3.4)。呼び出し側(Manage.svelte)が `view.tab ?? "project"` で補完する
		expect(view.tab ?? "project").toBe("project");
	});
});
