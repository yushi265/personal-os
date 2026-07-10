import { Notice } from "obsidian";
import type { Entity } from "../domain/entity";
import { today } from "../domain/date";
import {
	buildAiExport,
	buildAiSummary,
	type ExportGoalNode,
	type ExportProjectNode,
	type ExportSnapshot,
	type ExportTicketNode,
	type OverdueItem,
	type ReviewNeededItem,
	type SummarySnapshot,
	type UnlinkedEntity,
} from "../domain/export";
import { isOverdue, isReviewNeeded, isTodoOverdue } from "../domain/judge";
import { isCancelledTodo, type Todo } from "../domain/todo";
import type { IndexStore } from "../infra/IndexStore";
import { aiContextCopiedNotice, aiSummaryCopiedNotice, t } from "../i18n/ja";

const OPEN_TICKET_STATUS = "doing";

function allEntities(store: IndexStore): Entity[] {
	return [...store.listByType("goal"), ...store.listByType("project"), ...store.listByType("ticket")];
}

function buildTicketNode(store: IndexStore, ticket: Entity): ExportTicketNode {
	return { ticket, todos: store.getTodos(ticket.path) };
}

function buildProjectNode(store: IndexStore, project: Entity): ExportProjectNode {
	const tickets = store
		.getChildren(project.path)
		.filter((e) => e.type === "ticket")
		.map((ticket) => buildTicketNode(store, ticket));
	return { project, tickets, directTodos: store.getTodos(project.path) };
}

function buildGoalNode(store: IndexStore, goal: Entity): ExportGoalNode {
	const projects = store
		.getChildren(goal.path)
		.filter((e) => e.type === "project")
		.map((project) => buildProjectNode(store, project));
	return { goal, projects };
}

/** goal/projectのリンク先が未設定・解決不能な孤児Project/Ticketを検出する */
function findUnlinked(store: IndexStore): UnlinkedEntity[] {
	const unlinked: UnlinkedEntity[] = [];
	for (const project of store.listByType("project")) {
		if (!project.goal || !store.get(project.goal)) unlinked.push({ entity: project });
	}
	for (const ticket of store.listByType("ticket")) {
		if (!ticket.project || !store.get(ticket.project)) unlinked.push({ entity: ticket });
	}
	return unlinked;
}

function buildOverdueItems(store: IndexStore, entities: Entity[], now: string): OverdueItem[] {
	const entityItems: OverdueItem[] = entities
		.filter((e) => isOverdue(e, now))
		.map((e) => ({ title: e.title, due: e.due!, kind: "entity" as const }));
	const todoItems: OverdueItem[] = store
		.getAllTodos()
		.filter((t) => isTodoOverdue(t, now))
		.map((t) => ({
			title: t.text,
			due: t.dueDate!,
			kind: "todo" as const,
			parentTitle: store.get(t.parentPath)?.title,
		}));
	return [...entityItems, ...todoItems];
}

function buildReviewNeededItems(entities: Entity[], now: string): ReviewNeededItem[] {
	return entities
		.filter((e) => isReviewNeeded(e, now))
		.map((e) => ({ title: e.title, cycle: e.reviewCycle!, lastReviewed: e.lastReviewed }));
}

// POS-3 AC-7: cancelledは「やらないことにした仕事」のため未完了Todo件数に数えない
function countOpenTodos(todos: Todo[]): number {
	return todos.filter((t) => !t.done && !isCancelledTodo(t)).length;
}

/**
 * AI Export / AI Summary(design.md §4.5 / detail-design.md §4.5)。
 * IndexStoreから集計したプレーンデータ(snapshot)をdomain/export.tsの純粋関数に渡し、
 * 組み立てた文字列をクリップボードへコピーする。
 */
export class ExportService {
	constructor(private store: IndexStore) {}

	async exportAiContext(): Promise<void> {
		const now = today();
		const entities = allEntities(this.store);
		const snapshot: ExportSnapshot = {
			today: now,
			goals: this.store
				.listByType("goal")
				.filter((g) => g.status === "active" || g.status === "paused")
				.map((goal) => buildGoalNode(this.store, goal)),
			unlinked: findUnlinked(this.store),
			overdue: buildOverdueItems(this.store, entities, now),
			reviewNeeded: buildReviewNeededItems(entities, now),
		};
		const text = buildAiExport(snapshot);
		await this.copyToClipboard(text, (n) => aiContextCopiedNotice(n));
	}

	async exportAiSummary(): Promise<void> {
		const now = today();
		const entities = allEntities(this.store);
		const snapshot: SummarySnapshot = {
			today: now,
			activeProjectsCount: this.store.listByType("project").filter((p) => p.status === "active").length,
			doingTicketsCount: this.store.listByType("ticket").filter((t) => t.status === OPEN_TICKET_STATUS).length,
			openTodoCount: countOpenTodos(this.store.getAllTodos()),
			overdue: buildOverdueItems(this.store, entities, now),
			reviewNeeded: buildReviewNeededItems(entities, now),
		};
		const text = buildAiSummary(snapshot);
		await this.copyToClipboard(text, (n) => aiSummaryCopiedNotice(n));
	}

	private async copyToClipboard(text: string, successNotice: (n: number) => string): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			new Notice(successNotice(text.length));
		} catch (e) {
			console.error("Personal OS: clipboard write failed", e);
			new Notice(t("E006"));
		}
	}
}
