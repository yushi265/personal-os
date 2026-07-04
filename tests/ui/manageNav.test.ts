import { describe, expect, it } from "vitest";
import { IndexStore } from "../../src/infra/IndexStore";
import type { Entity } from "../../src/domain/entity";
import type { SavedView } from "../../src/settings/settings";
import {
	isManageSavedViewVisible,
	makeGoalDetailScreen,
	makeProjectDetailScreen,
	makeTicketDetailScreen,
	popOne,
	popTo,
	pushScreen,
	reconcileStack,
	resolveNavigateAction,
	type ManageScreen,
} from "../../src/ui/manage/manageNav";

function makeSavedView(overrides: Partial<SavedView> = {}): SavedView {
	return {
		id: "v1",
		name: "view",
		query: "",
		sort: { key: "priority", order: "asc" },
		viewMode: "manage",
		...overrides,
	};
}

function makeEntity(overrides: Partial<Entity> = {}): Entity {
	return {
		path: "a.md",
		type: "project",
		title: "a",
		status: "active",
		tags: [],
		labels: [],
		blockers: [],
		extra: {},
		...overrides,
	};
}

describe("manageNav stack operations (design-drilldown-nav.md §8.1)", () => {
	it("N-1: pushScreen appends a new project-detail frame", () => {
		const stack: ManageScreen[] = [{ kind: "project-list" }];
		const next = pushScreen(stack, makeProjectDetailScreen("p1"));
		expect(next).toHaveLength(2);
		expect(next[1]).toMatchObject({ kind: "project-detail", path: "p1" });
	});

	it("N-2: popTo(stack, 0) truncates to project-list only", () => {
		const stack: ManageScreen[] = [
			{ kind: "project-list" },
			makeProjectDetailScreen("p1"),
			makeTicketDetailScreen("t1"),
		];
		const next = popTo(stack, 0);
		expect(next).toEqual([{ kind: "project-list" }]);
	});

	it("N-3: popTo(stack, 1) keeps project-list + project-detail", () => {
		const stack: ManageScreen[] = [
			{ kind: "project-list" },
			makeProjectDetailScreen("p1"),
			makeTicketDetailScreen("t1"),
		];
		const next = popTo(stack, 1);
		expect(next).toHaveLength(2);
		expect(next[1].kind).toBe("project-detail");
	});

	it("N-4: popOne removes the last frame", () => {
		const stack: ManageScreen[] = [
			{ kind: "project-list" },
			makeProjectDetailScreen("p1"),
			makeTicketDetailScreen("t1"),
		];
		const next = popOne(stack);
		expect(next).toHaveLength(2);
		expect(next[1].kind).toBe("project-detail");
	});

	it("N-5: popTo with an out-of-range index returns the stack unchanged", () => {
		const stack: ManageScreen[] = [{ kind: "project-list" }, makeProjectDetailScreen("p1")];
		expect(popTo(stack, -1)).toBe(stack);
		expect(popTo(stack, 99)).toBe(stack);
	});

	it("N-6: makeProjectDetailScreen produces independent page-local state per call", () => {
		const a = makeProjectDetailScreen("p1");
		const b = makeProjectDetailScreen("p1");
		if (a.kind !== "project-detail" || b.kind !== "project-detail") throw new Error("unreachable");
		a.ticketFilter.keyword = "changed";
		expect(b.ticketFilter.keyword).toBe("");
	});

	it("N-7: pushScreen appends a new goal-detail frame", () => {
		const stack: ManageScreen[] = [{ kind: "project-list" }];
		const next = pushScreen(stack, makeGoalDetailScreen("g1"));
		expect(next).toHaveLength(2);
		expect(next[1]).toMatchObject({ kind: "goal-detail", path: "g1" });
	});

	it("N-8: makeGoalDetailScreen produces independent page-local state per call", () => {
		const a = makeGoalDetailScreen("g1");
		const b = makeGoalDetailScreen("g1");
		if (a.kind !== "goal-detail" || b.kind !== "goal-detail") throw new Error("unreachable");
		a.projectFilter.keyword = "changed";
		expect(b.projectFilter.keyword).toBe("");
	});
});

describe("reconcileStack (design-drilldown-nav.md §8.2)", () => {
	it("R-1: deleted project-detail entity truncates to project-list, truncated: true", () => {
		const store = new IndexStore();
		const stack: ManageScreen[] = [{ kind: "project-list" }, makeProjectDetailScreen("A")];
		const result = reconcileStack(stack, store, []);
		expect(result.truncated).toBe(true);
		expect(result.stack).toEqual([{ kind: "project-list" }]);
	});

	it("R-2: only the deleted ticket-detail frame (and above) is truncated; valid ancestor survives", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "A", type: "project", title: "A" }));
		const stack: ManageScreen[] = [
			{ kind: "project-list" },
			makeProjectDetailScreen("A"),
			makeTicketDetailScreen("B"),
		];
		const result = reconcileStack(stack, store, []);
		expect(result.truncated).toBe(true);
		expect(result.stack).toHaveLength(2);
		expect(result.stack[1]).toMatchObject({ kind: "project-detail", path: "A" });
	});

	it("R-3: archived project-detail entity is treated the same as deletion", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "A", type: "project", title: "A", status: "archived" }));
		const stack: ManageScreen[] = [{ kind: "project-list" }, makeProjectDetailScreen("A")];
		const result = reconcileStack(stack, store, []);
		expect(result.truncated).toBe(true);
		expect(result.stack).toEqual([{ kind: "project-list" }]);
	});

	it("R-4: rename with matching type follows the path in place, no truncation", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "B-new", type: "ticket", title: "B" }));
		const stack: ManageScreen[] = [{ kind: "project-list" }, makeTicketDetailScreen("B-old")];
		const result = reconcileStack(stack, store, [["B-old", "B-new"]]);
		expect(result.truncated).toBe(false);
		expect(result.stack[1]).toMatchObject({ kind: "ticket-detail", path: "B-new" });
	});

	it("R-5: rename with type mismatch (ticket promoted to project) is treated as vanished", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "B-new", type: "project", title: "B" }));
		const stack: ManageScreen[] = [{ kind: "project-list" }, makeTicketDetailScreen("B-old")];
		const result = reconcileStack(stack, store, [["B-old", "B-new"]]);
		expect(result.truncated).toBe(true);
		expect(result.stack).toEqual([{ kind: "project-list" }]);
	});

	it("R-6: empty renames with all frames valid leaves the stack unchanged", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "A", type: "project", title: "A" }));
		const stack: ManageScreen[] = [{ kind: "project-list" }, makeProjectDetailScreen("A")];
		const result = reconcileStack(stack, store, []);
		expect(result.truncated).toBe(false);
		expect(result.stack).toMatchObject([{ kind: "project-list" }, { kind: "project-detail", path: "A" }]);
	});

	it("R-7: project-list alone is never touched by reconciliation", () => {
		const store = new IndexStore();
		const stack: ManageScreen[] = [{ kind: "project-list" }];
		const result = reconcileStack(stack, store, [["x", "y"]]);
		expect(result.truncated).toBe(false);
		expect(result.stack).toEqual([{ kind: "project-list" }]);
	});

	it("R-8: deleted/archived goal-detail entity truncates to project-list, truncated: true", () => {
		const store = new IndexStore();
		const stack: ManageScreen[] = [{ kind: "project-list" }, makeGoalDetailScreen("G")];
		const result = reconcileStack(stack, store, []);
		expect(result.truncated).toBe(true);
		expect(result.stack).toEqual([{ kind: "project-list" }]);
	});

	it("R-9: rename of a goal-detail frame follows the path in place, no truncation", () => {
		const store = new IndexStore();
		store.upsertEntity(makeEntity({ path: "G-new", type: "goal", title: "G" }));
		const stack: ManageScreen[] = [{ kind: "project-list" }, makeGoalDetailScreen("G-old")];
		const result = reconcileStack(stack, store, [["G-old", "G-new"]]);
		expect(result.truncated).toBe(false);
		expect(result.stack[1]).toMatchObject({ kind: "goal-detail", path: "G-new" });
	});
});

describe("resolveNavigateAction (design-drilldown-nav.md §4.1 navigateOrOpen routing)", () => {
	it("D-1: project entity without modifier click routes to project-detail", () => {
		expect(resolveNavigateAction("project", false)).toBe("project-detail");
	});

	it("D-2: ticket entity without modifier click routes to ticket-detail", () => {
		expect(resolveNavigateAction("ticket", false)).toBe("ticket-detail");
	});

	it("D-3: modifier click always opens the note, even for project/ticket", () => {
		expect(resolveNavigateAction("project", true)).toBe("open-note");
		expect(resolveNavigateAction("ticket", true)).toBe("open-note");
	});

	it("D-4: goal entity without modifier click routes to goal-detail", () => {
		expect(resolveNavigateAction("goal", false)).toBe("goal-detail");
	});

	it("D-4b: modifier click on a goal opens the note", () => {
		expect(resolveNavigateAction("goal", true)).toBe("open-note");
	});

	it("D-4c: review/resource/inbox entities always open the note (no detail screen for these types)", () => {
		expect(resolveNavigateAction("review", false)).toBe("open-note");
		expect(resolveNavigateAction("resource", false)).toBe("open-note");
		expect(resolveNavigateAction("inbox", false)).toBe("open-note");
	});

	it("D-5: undefined entity type (e.g. parse-error path not in store) opens the note", () => {
		expect(resolveNavigateAction(undefined, false)).toBe("open-note");
	});
});

describe("isManageSavedViewVisible (design-drilldown-nav.md §5.2 / §8.5)", () => {
	it("S-1: viewMode:manage, tab:project is shown in the picker", () => {
		expect(isManageSavedViewVisible(makeSavedView({ tab: "project" }))).toBe(true);
	});

	it("S-2: viewMode:manage with no tab field (pre-tab legacy data) is shown in the picker", () => {
		expect(isManageSavedViewVisible(makeSavedView({ tab: undefined }))).toBe(true);
	});

	it("S-3: viewMode:manage, tab:ticket is excluded from the picker (no error)", () => {
		expect(isManageSavedViewVisible(makeSavedView({ tab: "ticket" }))).toBe(false);
	});

	it("S-4: viewMode:manage, tab:todo is excluded from the picker (no error)", () => {
		expect(isManageSavedViewVisible(makeSavedView({ tab: "todo" }))).toBe(false);
	});

	it("S-5: viewMode:list / viewMode:kanban are excluded (Search/Kanban own their picker logic)", () => {
		expect(isManageSavedViewVisible(makeSavedView({ viewMode: "list" }))).toBe(false);
		expect(isManageSavedViewVisible(makeSavedView({ viewMode: "kanban" }))).toBe(false);
	});
});
