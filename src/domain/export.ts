/**
 * Domain層: AI Export / AI Summary の文字列組み立て(design.md §4.5 / detail-design.md §4.5)。
 * このファイルはObsidian APIに一切依存しない純粋TypeScriptとする。
 * IndexStoreからの集計・抽出はExportService(services層)が担い、ここでは組み立てのみ行う。
 */

import type { Entity } from "./entity";
import type { Todo } from "./todo";

export interface ExportTicketNode {
	ticket: Entity;
	todos: Todo[];
}

export interface ExportProjectNode {
	project: Entity;
	tickets: ExportTicketNode[];
	directTodos: Todo[];
}

export interface ExportGoalNode {
	goal: Entity;
	projects: ExportProjectNode[];
}

/** 親リンク切れ・親未設定の孤児Entity */
export interface UnlinkedEntity {
	entity: Entity;
}

/** Overdue セクション用の統一表現(Entity/Todoいずれも title+due で表示) */
export interface OverdueItem {
	title: string;
	due: string;
	/** kind:"todo" の場合のみ、所属ノートのタイトル(解決できた場合) */
	parentTitle?: string;
	kind: "entity" | "todo";
}

export interface ReviewNeededItem {
	title: string;
	cycle: string;
	lastReviewed?: string;
}

export interface ExportSnapshot {
	today: string;
	goals: ExportGoalNode[];
	unlinked: UnlinkedEntity[];
	overdue: OverdueItem[];
	reviewNeeded: ReviewNeededItem[];
}

export interface SummarySnapshot {
	today: string;
	activeProjectsCount: number;
	doingTicketsCount: number;
	openTodoCount: number;
	overdue: OverdueItem[];
	reviewNeeded: ReviewNeededItem[];
}

function fmtPriority(priority: Entity["priority"]): string {
	return priority ?? "-";
}

function fmtDue(due: string | undefined): string {
	return due ?? "-";
}

function fmtProgress(progress: number | undefined): string {
	return String(progress ?? 0);
}

function fmtTodoLine(todo: Todo): string {
	const checkbox = todo.done ? "- [x]" : "- [ ]";
	const due = todo.dueDate ? ` 📅 ${todo.dueDate}` : "";
	return `${checkbox} ${todo.text}${due}`;
}

function buildTicketSection(node: ExportTicketNode): string[] {
	const lines: string[] = [];
	lines.push(`##### ${node.ticket.title} (${node.ticket.status}, progress: ${fmtProgress(node.ticket.progress)}%)`);
	if (node.todos.length === 0) {
		lines.push("- (Todoなし)");
	} else {
		for (const todo of node.todos) lines.push(fmtTodoLine(todo));
	}
	return lines;
}

function buildProjectSection(node: ExportProjectNode): string[] {
	const lines: string[] = [];
	const { project } = node;
	lines.push(`#### ${project.title} (${project.status}, progress: ${fmtProgress(project.progress)}%, due: ${fmtDue(project.due)})`);
	const ticketSummary =
		node.tickets.length > 0
			? node.tickets.map((t) => `${t.ticket.title} (${t.ticket.status}, ${fmtProgress(t.ticket.progress)}%)`).join(", ")
			: "なし";
	lines.push(`- Tickets: ${ticketSummary}`);
	if (node.directTodos.length > 0) {
		lines.push("##### Todo");
		for (const todo of node.directTodos) lines.push(fmtTodoLine(todo));
	}
	for (const ticket of node.tickets) {
		lines.push(...buildTicketSection(ticket));
	}
	return lines;
}

function buildGoalSection(node: ExportGoalNode): string[] {
	const lines: string[] = [];
	lines.push(`### ${node.goal.title} (${node.goal.status}, priority: ${fmtPriority(node.goal.priority)})`);
	if (node.projects.length === 0) {
		lines.push("(Projectなし)");
	} else {
		for (const project of node.projects) lines.push(...buildProjectSection(project));
	}
	return lines;
}

function buildOverdueLine(item: OverdueItem): string {
	if (item.kind === "todo") {
		const parent = item.parentTitle ? ` (${item.parentTitle})` : "";
		return `- [ ] ${item.title} 📅 ${item.due}${parent}`;
	}
	return `- ${item.title} 📅 ${item.due}`;
}

/** AI Export本文を組み立てる(design.md §4.5の出力構造) */
export function buildAiExport(snapshot: ExportSnapshot): string {
	const lines: string[] = [];
	lines.push(`# Personal OS Context (${snapshot.today})`);
	lines.push("");

	lines.push("## Goals");
	if (snapshot.goals.length === 0) {
		lines.push("(該当なし)");
	} else {
		for (const goal of snapshot.goals) {
			lines.push("");
			lines.push(...buildGoalSection(goal));
		}
	}
	lines.push("");

	lines.push("## Unlinked");
	if (snapshot.unlinked.length === 0) {
		lines.push("(該当なし)");
	} else {
		for (const { entity } of snapshot.unlinked) {
			lines.push(`- [${entity.type}] ${entity.title} (${entity.status})`);
		}
	}
	lines.push("");

	lines.push("## Overdue");
	if (snapshot.overdue.length === 0) {
		lines.push("(該当なし)");
	} else {
		for (const item of snapshot.overdue) lines.push(buildOverdueLine(item));
	}
	lines.push("");

	lines.push("## Review Needed");
	if (snapshot.reviewNeeded.length === 0) {
		lines.push("(該当なし)");
	} else {
		for (const item of snapshot.reviewNeeded) {
			lines.push(`- ${item.title} (${item.cycle}, last: ${item.lastReviewed ?? "未実施"})`);
		}
	}

	return lines.join("\n").trimEnd() + "\n";
}

/** AI Summary本文を組み立てる(detail-design.md §4.5の出力仕様) */
export function buildAiSummary(snapshot: SummarySnapshot): string {
	const lines: string[] = [];
	lines.push(`# Personal OS Summary (${snapshot.today})`);
	lines.push(
		`- Active Projects: ${snapshot.activeProjectsCount} / Tickets(doing): ${snapshot.doingTicketsCount} / 未完了Todo: ${snapshot.openTodoCount}`
	);

	const overdueDigest =
		snapshot.overdue.length > 0 ? snapshot.overdue.map((i) => `${i.title} 📅${i.due}`).join(", ") : "なし";
	lines.push(`- ⚠ Overdue: ${snapshot.overdue.length}件(${overdueDigest})`);

	const reviewDigest =
		snapshot.reviewNeeded.length > 0
			? snapshot.reviewNeeded.map((i) => `${i.title}: ${i.cycle}, last ${i.lastReviewed ?? "未実施"}`).join(", ")
			: "なし";
	lines.push(`- 🔍 Review Needed: ${snapshot.reviewNeeded.length}件(${reviewDigest})`);

	return lines.join("\n") + "\n";
}
