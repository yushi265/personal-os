/**
 * Domain層: Entity型定義・parseEntity()
 * このファイルはObsidian APIに一切依存しない純粋TypeScriptとする。
 * i18n/ja.ts はObsidian非依存の文言モジュールのため、ユーザー可視文言(ParseErrorWidget表示)の生成にのみ利用する。
 */
import { parseErrorInvalidStatus, parseErrorInvalidType, parseErrorNoType } from "../i18n/ja";

export const ENTITY_TYPES = ["goal", "project", "ticket", "review", "resource", "inbox"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const GOAL_STATUSES = ["active", "paused", "done", "archived"] as const;
export const PROJECT_STATUSES = ["backlog", "active", "waiting", "review", "done", "archived"] as const;
export const TICKET_STATUSES = ["backlog", "ready", "doing", "waiting", "review", "done", "cancelled", "archived"] as const;

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const REVIEW_CYCLES = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;
export type ReviewCycle = (typeof REVIEW_CYCLES)[number];

/** タイトルに使用できない文字。ノート作成・rename双方で共用する */
export const FORBIDDEN_TITLE_CHARS = /[\\/:*?"<>|#^[\]]/g;

/** 未完了statusの定義(judge.tsで使用) */
export const OPEN_STATUSES: Record<"project" | "ticket" | "goal", ReadonlySet<string>> = {
	goal: new Set(["active", "paused"]),
	project: new Set(["backlog", "active", "waiting", "review"]),
	ticket: new Set(["backlog", "ready", "doing", "waiting", "review"]),
};

export interface Entity {
	path: string;
	type: EntityType;
	title: string;
	status: string;
	goal?: string;
	project?: string;
	priority?: Priority;
	progress?: number;
	order?: number;
	start?: string;
	due?: string;
	reviewCycle?: ReviewCycle;
	lastReviewed?: string;
	archivedAt?: string;
	tags: string[];
	labels: string[];
	extra: Record<string, unknown>;
}

export type ParseResult = { ok: true; entity: Entity; warnings: string[] } | { ok: false; reason: string };

const KNOWN_FRONTMATTER_KEYS = new Set([
	"type",
	"status",
	"goal",
	"project",
	"priority",
	"progress",
	"order",
	"start",
	"due",
	"last_reviewed",
	"archived_at",
	"review_cycle",
	"tags",
	"labels",
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 一覧のデフォルト非表示判定(done/cancelled = 終端status)の共有述語 */
export function isClosedStatus(status: string): boolean {
	return status === "done" || status === "cancelled";
}

export function defaultStatusOf(type: EntityType): string {
	switch (type) {
		case "goal":
			return "active";
		case "project":
		case "ticket":
			return "backlog";
		default:
			return "active";
	}
}

/** null を返す場合はその type に status の許容値制約がないことを示す */
export function validStatusesOf(type: EntityType): readonly string[] | null {
	switch (type) {
		case "goal":
			return GOAL_STATUSES;
		case "project":
			return PROJECT_STATUSES;
		case "ticket":
			return TICKET_STATUSES;
		default:
			return null;
	}
}

function toStringArray(value: unknown): string[] {
	if (value === undefined || value === null) return [];
	if (Array.isArray(value)) return value.map((v) => String(v));
	return [String(value)];
}

function isValidDate(value: unknown): value is string {
	return typeof value === "string" && DATE_PATTERN.test(value);
}

function resolveEntityLink(
	raw: unknown,
	resolveLink: (link: string, expectedType?: EntityType) => string | null,
	warnings: string[],
	fieldName: string,
	expectedType?: EntityType
): string | undefined {
	if (raw === undefined || raw === null) return undefined;
	const str = String(raw);
	const linkText = str.replace(/^\[\[|\]\]$/g, "");
	const resolved = resolveLink(linkText, expectedType);
	if (resolved === null) {
		warnings.push(`${fieldName}のリンク解決に失敗: ${str}`);
		return str;
	}
	return resolved;
}

export function parseEntity(
	file: { path: string; basename: string },
	fm: Record<string, unknown> | undefined,
	resolveLink: (link: string, expectedType?: EntityType) => string | null
): ParseResult {
	if (!fm?.type) return { ok: false, reason: parseErrorNoType() };
	if (!ENTITY_TYPES.includes(fm.type as EntityType)) return { ok: false, reason: parseErrorInvalidType(fm.type) };
	const type = fm.type as EntityType;

	const status = String(fm.status ?? defaultStatusOf(type));
	const validStatuses = validStatusesOf(type);
	if (validStatuses && !validStatuses.includes(status)) {
		return { ok: false, reason: parseErrorInvalidStatus(status) };
	}

	const warnings: string[] = [];

	const goal = resolveEntityLink(fm.goal, resolveLink, warnings, "goal", "goal");
	const project = resolveEntityLink(fm.project, resolveLink, warnings, "project", "project");

	let priority: Priority | undefined;
	if (fm.priority !== undefined && fm.priority !== null) {
		const p = String(fm.priority);
		if (PRIORITIES.includes(p as Priority)) {
			priority = p as Priority;
		} else {
			warnings.push(`不正なpriority: ${p}`);
		}
	}

	let progress: number | undefined;
	if (fm.progress !== undefined && fm.progress !== null) {
		const n = Number(fm.progress);
		if (Number.isNaN(n)) {
			warnings.push(`不正なprogress: ${String(fm.progress)}`);
		} else {
			progress = Math.min(100, Math.max(0, n));
		}
	}

	let order: number | undefined;
	if (fm.order !== undefined && fm.order !== null) {
		const n = Number(fm.order);
		if (!Number.isNaN(n)) order = n;
		// 不正なorder(数値化不可)はwarning無しでundefined扱い(design-reorder-and-notes.md A-2)
	}

	const parseDateField = (raw: unknown, label: string): string | undefined => {
		if (raw === undefined || raw === null) return undefined;
		if (isValidDate(raw)) return raw;
		warnings.push(`不正な${label}: ${String(raw)}`);
		return undefined;
	};

	const start = parseDateField(fm.start, "start");
	const due = parseDateField(fm.due, "due");
	const lastReviewed = parseDateField(fm.last_reviewed, "last_reviewed");
	const archivedAt = parseDateField(fm.archived_at, "archived_at");

	let reviewCycle: ReviewCycle | undefined;
	if (fm.review_cycle !== undefined && fm.review_cycle !== null) {
		const c = String(fm.review_cycle);
		if (REVIEW_CYCLES.includes(c as ReviewCycle)) {
			reviewCycle = c as ReviewCycle;
		} else {
			warnings.push(`不正なreview_cycle: ${c}`);
		}
	}

	const tags = toStringArray(fm.tags);
	const labels = toStringArray(fm.labels);

	const extra: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(fm)) {
		if (!KNOWN_FRONTMATTER_KEYS.has(key)) {
			extra[key] = value;
		}
	}

	const entity: Entity = {
		path: file.path,
		type,
		title: file.basename,
		status,
		goal,
		project,
		priority,
		progress,
		order,
		start,
		due,
		reviewCycle,
		lastReviewed,
		archivedAt,
		tags,
		labels,
		extra,
	};

	return { ok: true, entity, warnings };
}

export interface OrderableRow {
	path: string;
	order?: number;
}

/**
 * D&D並び替え後のorder値算出(design-reorder-and-notes.md A-1)。疎な連番(100刻み)方式。
 * fromIndex/toIndexはArray.spliceのremove-then-insert方式(移動元を除去した後の配列に対する挿入位置)。
 * order未設定の行は「末尾」として扱う(隣接値としては「orderの概念が無い」＝境界なしとして扱う)。
 * 戻り値は実際にorder値が変化する行のみ(無関係な行のorderには一切触れない)。
 */
export function computeOrderForInsert(rows: OrderableRow[], fromIndex: number, toIndex: number): { path: string; order: number }[] {
	const arr = rows.slice();
	const [moved] = arr.splice(fromIndex, 1);
	if (!moved) return [];
	const insertAt = Math.max(0, Math.min(toIndex, arr.length));
	arr.splice(insertAt, 0, moved);

	const changes = new Map<string, number>();
	const setIfChanged = (row: OrderableRow, value: number): void => {
		if (row.order !== value) changes.set(row.path, value);
	};

	const prev = insertAt > 0 ? arr[insertAt - 1] : undefined;
	const next = insertAt < arr.length - 1 ? arr[insertAt + 1] : undefined;
	const prevOrder = prev?.order;
	const nextOrder = next?.order;

	if (nextOrder === undefined) {
		// 末尾追加相当(次のneighborが無い、または次がorder未設定=末尾扱い)
		setIfChanged(moved, prevOrder !== undefined ? prevOrder + 100 : 100);
	} else if (prevOrder === undefined) {
		// 先頭挿入相当: 仮想的にprevOrder=0として扱う
		const gap = nextOrder - 0;
		if (gap >= 2) setIfChanged(moved, Math.floor(nextOrder / 2));
		else renumberFrom(arr, insertAt, 0, changes);
	} else {
		const gap = nextOrder - prevOrder;
		if (gap >= 2) setIfChanged(moved, Math.floor((prevOrder + nextOrder) / 2));
		else renumberFrom(arr, insertAt, prevOrder, changes);
	}

	return Array.from(changes.entries()).map(([path, order]) => ({ path, order }));
}

/** gapが枯渇した場合のローカルrenumber。moved行から後方へ、衝突が解消するまでのみ100刻みで採番し直す */
function renumberFrom(arr: OrderableRow[], startIdx: number, baseOrder: number, changes: Map<string, number>): void {
	let current = baseOrder;
	for (let i = startIdx; i < arr.length; i++) {
		const row = arr[i];
		current += 100;
		if (i > startIdx) {
			const existing = row.order;
			if (existing !== undefined && existing > current) break; // これ以降は衝突が解消済み
		}
		if (row.order !== current) changes.set(row.path, current);
	}
}
