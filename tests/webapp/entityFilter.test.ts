import { describe, expect, it } from "vitest";
import { collectLabelOptions, matchesFilter, matchesLabels } from "../../webapp/src/lib/entityFilter";

describe("matchesLabels", () => {
	it("[同値分割] selected空 + labels空 → true(フィルタ未指定は全通し)", () => {
		expect(matchesLabels([], new Set())).toBe(true);
	});

	it("[同値分割] selected空 + labels[a] → true", () => {
		expect(matchesLabels(["a"], new Set())).toBe(true);
	});

	it("[同値分割] selected{a} + labels[a,b] → true", () => {
		expect(matchesLabels(["a", "b"], new Set(["a"]))).toBe(true);
	});

	it("[同値分割] selected{a} + labels[b] → false", () => {
		expect(matchesLabels(["b"], new Set(["a"]))).toBe(false);
	});

	it("[境界値] selected{a} + labels[] → false", () => {
		expect(matchesLabels([], new Set(["a"]))).toBe(false);
	});

	it("[同値分割] selected{a,c} + labels[c] → true(OR: いずれか一致で可)", () => {
		expect(matchesLabels(["c"], new Set(["a", "c"]))).toBe(true);
	});

	it("[代表値] selected{A} + labels[a] → false(大文字小文字区別 = domain/query.tsと同一意味論)", () => {
		expect(matchesLabels(["a"], new Set(["A"]))).toBe(false);
	});
});

describe("collectLabelOptions", () => {
	it("[代表値] 一意化+localeCompare昇順", () => {
		expect(
			collectLabelOptions([{ labels: ["b", "a"] }, { labels: ["a", "c"] }])
		).toEqual(["a", "b", "c"]);
	});

	it("[境界値] 空配列入力 → []", () => {
		expect(collectLabelOptions([])).toEqual([]);
	});

	it("[境界値] 全要素labels:[] → []", () => {
		expect(collectLabelOptions([{ labels: [] }, { labels: [] }])).toEqual([]);
	});
});

describe("matchesFilter", () => {
	const entity = { title: "銀行比較", status: "doing", labels: ["finance"] };

	it("[デシジョンテーブル] 全条件未指定 → true", () => {
		expect(matchesFilter(entity, "", new Set(), new Set())).toBe(true);
	});

	it("[デシジョンテーブル] keywordのみ指定・一致 → true", () => {
		expect(matchesFilter(entity, "銀行", new Set(), new Set())).toBe(true);
	});

	it("[デシジョンテーブル] keywordのみ指定・不一致 → false", () => {
		expect(matchesFilter(entity, "旅行", new Set(), new Set())).toBe(false);
	});

	it("[デシジョンテーブル] statusesのみ指定・一致 → true", () => {
		expect(matchesFilter(entity, "", new Set(["doing"]), new Set())).toBe(true);
	});

	it("[デシジョンテーブル] statusesのみ指定・不一致 → false", () => {
		expect(matchesFilter(entity, "", new Set(["backlog"]), new Set())).toBe(false);
	});

	it("[デシジョンテーブル] labelsのみ指定・一致 → true", () => {
		expect(matchesFilter(entity, "", new Set(), new Set(["finance"]))).toBe(true);
	});

	it("[デシジョンテーブル] labelsのみ指定・不一致 → false", () => {
		expect(matchesFilter(entity, "", new Set(), new Set(["urgent"]))).toBe(false);
	});

	it("[デシジョンテーブル] 3条件指定・全一致 → true", () => {
		expect(matchesFilter(entity, "銀行", new Set(["doing"]), new Set(["finance"]))).toBe(true);
	});

	it("[デシジョンテーブル] 3条件指定・keywordのみ不一致 → false", () => {
		expect(matchesFilter(entity, "旅行", new Set(["doing"]), new Set(["finance"]))).toBe(false);
	});

	it("[デシジョンテーブル] 3条件指定・statusesのみ不一致 → false", () => {
		expect(matchesFilter(entity, "銀行", new Set(["backlog"]), new Set(["finance"]))).toBe(false);
	});

	it("[デシジョンテーブル] 3条件指定・labelsのみ不一致 → false", () => {
		expect(matchesFilter(entity, "銀行", new Set(["doing"]), new Set(["urgent"]))).toBe(false);
	});

	it("[同値分割] keywordは大文字小文字無視でtitle部分一致(既存挙動のリグレッション)", () => {
		expect(matchesFilter({ title: "Bank Compare", status: "doing", labels: [] }, "BANK", new Set(), new Set())).toBe(
			true
		);
	});

	it("[境界値] keywordが空白のみ→keywordでは絞り込まない(既存trim挙動のリグレッション)", () => {
		expect(matchesFilter(entity, "   ", new Set(), new Set())).toBe(true);
	});

	it("[デシジョンテーブル] hideDone=true + status\"done\" → false(完了を隠す)", () => {
		expect(matchesFilter({ title: "銀行比較", status: "done", labels: [] }, "", new Set(), new Set(), true)).toBe(false);
	});

	it("[デシジョンテーブル] hideDone=true + status\"active\" → true(未完了は通す)", () => {
		expect(matchesFilter({ title: "銀行比較", status: "active", labels: [] }, "", new Set(), new Set(), true)).toBe(true);
	});

	it("[デシジョンテーブル] hideDone=false(既定・省略) + status\"done\" → true(既定挙動のリグレッション)", () => {
		expect(matchesFilter({ title: "銀行比較", status: "done", labels: [] }, "", new Set(), new Set())).toBe(true);
	});

	it("[デシジョンテーブル] hideDone=true + 他条件も全一致 + status\"done\" → false(hideDoneが優先)", () => {
		expect(
			matchesFilter({ title: "銀行比較", status: "done", labels: ["finance"] }, "銀行", new Set(["done"]), new Set(["finance"]), true)
		).toBe(false);
	});

	it("[デシジョンテーブル] hideDone=true + 他条件も全一致 + status\"doing\" → true(hideDoneは非done時に無影響)", () => {
		expect(
			matchesFilter({ title: "銀行比較", status: "doing", labels: ["finance"] }, "銀行", new Set(["doing"]), new Set(["finance"]), true)
		).toBe(true);
	});
});
