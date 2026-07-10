import { describe, expect, it } from "vitest";
import { PROJECT_STATUSES } from "../../../src/domain/entity";
import type { Entity } from "../../../src/domain/entity";
import { IndexStore } from "../../../src/infra/IndexStore";
import { DEFAULT_SETTINGS } from "../../../src/settings/settings";
import type PersonalOSPlugin from "../../../src/main";
import { buildKanbanData, sortEntities } from "../../../src/ui/kanban/kanbanData";

function makePlugin(store: IndexStore): PersonalOSPlugin {
	return { store, settings: DEFAULT_SETTINGS } as unknown as PersonalOSPlugin;
}

function makeEntity(overrides: Partial<Entity> = {}): Entity {
	return {
		path: "PersonalOS/Tickets/ticket-a.md",
		type: "ticket",
		title: "ticket-a",
		status: "doing",
		tags: [],
		labels: [],
		extra: {},
		...overrides,
	};
}

describe("sortEntities", () => {
	it("sorts by order ascending when both sides have order", () => {
		const a = makeEntity({ path: "a.md", title: "a", order: 300 });
		const b = makeEntity({ path: "b.md", title: "b", order: 100 });
		const c = makeEntity({ path: "c.md", title: "c", order: 200 });

		expect(sortEntities([a, b, c]).map((e) => e.title)).toEqual(["b", "c", "a"]);
	});

	it("sorts entities with order before entities without order", () => {
		const withOrder = makeEntity({ path: "a.md", title: "zebra", order: 100 });
		const withoutOrder = makeEntity({ path: "b.md", title: "apple" });

		expect(sortEntities([withoutOrder, withOrder]).map((e) => e.title)).toEqual(["zebra", "apple"]);
	});

	it("falls back to priority -> due -> title when both sides lack order", () => {
		const high = makeEntity({ path: "a.md", title: "b", priority: "high" });
		const low = makeEntity({ path: "b.md", title: "a", priority: "low" });

		expect(sortEntities([low, high]).map((e) => e.title)).toEqual(["b", "a"]);
	});

	it("falls back to due ascending when priorities tie and both lack order", () => {
		const later = makeEntity({ path: "a.md", title: "a", due: "2026-07-10" });
		const sooner = makeEntity({ path: "b.md", title: "b", due: "2026-07-01" });

		expect(sortEntities([later, sooner]).map((e) => e.title)).toEqual(["b", "a"]);
	});
});

describe("buildKanbanData", () => {
	it("excludes archived and cancelled from the ticket mode columns (POS-3 AC-3)", () => {
		const plugin = makePlugin(new IndexStore());

		const data = buildKanbanData(plugin, "ticket");

		const statuses = data.columns.map((c) => c.status);
		expect(statuses).not.toContain("archived");
		expect(statuses).not.toContain("cancelled");
	});

	it("keeps the project mode columns unchanged", () => {
		const plugin = makePlugin(new IndexStore());

		const data = buildKanbanData(plugin, "project");

		expect(data.columns.map((c) => c.status)).toEqual([...PROJECT_STATUSES]);
	});
});
