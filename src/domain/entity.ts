/**
 * Domain層: Entity型定義・parseEntity()
 * このファイルはObsidian APIに一切依存しない純粋TypeScriptとする。
 */

export const ENTITY_TYPES = ["goal", "project", "ticket", "review", "resource", "inbox"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const GOAL_STATUSES = ["active", "paused", "done", "archived"] as const;
export const PROJECT_STATUSES = ["backlog", "active", "waiting", "review", "done", "archived"] as const;
export const TICKET_STATUSES = ["backlog", "ready", "doing", "waiting", "review", "done", "archived"] as const;

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const REVIEW_CYCLES = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;
export type ReviewCycle = (typeof REVIEW_CYCLES)[number];

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
	start?: string;
	due?: string;
	reviewCycle?: ReviewCycle;
	lastReviewed?: string;
	archivedAt?: string;
	tags: string[];
	labels: string[];
	blockers: string[];
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
	"start",
	"due",
	"last_reviewed",
	"archived_at",
	"review_cycle",
	"tags",
	"labels",
	"blockers",
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
	resolveLink: (link: string) => string | null,
	warnings: string[],
	fieldName: string
): string | undefined {
	if (raw === undefined || raw === null) return undefined;
	const str = String(raw);
	const linkText = str.replace(/^\[\[|\]\]$/g, "");
	const resolved = resolveLink(linkText);
	if (resolved === null) {
		warnings.push(`${fieldName}のリンク解決に失敗: ${str}`);
		return str;
	}
	return resolved;
}

export function parseEntity(
	file: { path: string; basename: string },
	fm: Record<string, unknown> | undefined,
	resolveLink: (link: string) => string | null
): ParseResult {
	if (!fm?.type) return { ok: false, reason: "type未定義" };
	if (!ENTITY_TYPES.includes(fm.type as EntityType)) return { ok: false, reason: `不正なtype: ${fm.type}` };
	const type = fm.type as EntityType;

	const status = String(fm.status ?? defaultStatusOf(type));
	const validStatuses = validStatusesOf(type);
	if (validStatuses && !validStatuses.includes(status)) {
		return { ok: false, reason: `不正なstatus: ${status}` };
	}

	const warnings: string[] = [];

	const goal = resolveEntityLink(fm.goal, resolveLink, warnings, "goal");
	const project = resolveEntityLink(fm.project, resolveLink, warnings, "project");

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
	const blockers = toStringArray(fm.blockers);

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
		start,
		due,
		reviewCycle,
		lastReviewed,
		archivedAt,
		tags,
		labels,
		blockers,
		extra,
	};

	return { ok: true, entity, warnings };
}
