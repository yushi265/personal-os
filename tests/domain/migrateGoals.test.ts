import { describe, expect, it } from "vitest";
import { computeGoalLabelMigration } from "../../src/domain/migrateGoals";

describe("computeGoalLabelMigration", () => {
	it("MG-1: resolved goal(store登録あり)はgoalのtitleをlabelsへ追加する", () => {
		const result = computeGoalLabelMigration(
			{ path: "Projects/p.md", labels: ["work"], goalRaw: "Goals/g.md" },
			(path) => (path === "Goals/g.md" ? "健康" : undefined)
		);
		expect(result.labels).toEqual(["work", "健康"]);
	});

	it("MG-2: 既に同名labelを持つ場合は重複追加しない", () => {
		const result = computeGoalLabelMigration(
			{ path: "Projects/p.md", labels: ["健康"], goalRaw: "Goals/g.md" },
			(path) => (path === "Goals/g.md" ? "健康" : undefined)
		);
		expect(result.labels).toEqual(["健康"]);
	});

	it("MG-3: labelsが空(goalなしケースは呼び出し元でスキップされる想定だが)でも1件追加できる", () => {
		const result = computeGoalLabelMigration({ path: "Projects/p.md", labels: [], goalRaw: "Goals/g.md" }, () => "学習");
		expect(result.labels).toEqual(["学習"]);
	});

	it("MG-4: リンク切れ(store未登録)のgoalはraw文字列をlabel化する", () => {
		const result = computeGoalLabelMigration({ path: "Projects/p.md", labels: [], goalRaw: "存在しないGoal" }, () => undefined);
		expect(result.labels).toEqual(["存在しないGoal"]);
	});

	it("MG-5: リンク切れgoalが [[Title]] 形式の場合は角括弧を除去してlabel化する", () => {
		const result = computeGoalLabelMigration({ path: "Projects/p.md", labels: [], goalRaw: "[[消えたGoal]]" }, () => undefined);
		expect(result.labels).toEqual(["消えたGoal"]);
	});

	it("MG-6: 元のlabels配列を破壊しない(非破壊)", () => {
		const original = ["work"];
		computeGoalLabelMigration({ path: "Projects/p.md", labels: original, goalRaw: "Goals/g.md" }, () => "健康");
		expect(original).toEqual(["work"]);
	});
});
