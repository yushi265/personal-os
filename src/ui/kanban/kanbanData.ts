import { PROJECT_STATUSES, TICKET_STATUSES, type Entity, type EntityType } from "../../domain/entity";
import type PersonalOSPlugin from "../../main";

export type KanbanMode = "ticket" | "project";

export interface KanbanColumnData {
	status: string;
	label: string;
	entities: Entity[];
}

export interface KanbanData {
	mode: KanbanMode;
	columns: KanbanColumnData[];
}

export const EMPTY_KANBAN_DATA: KanbanData = { mode: "ticket", columns: [] };

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function priorityRank(e: Entity): number {
	return e.priority ? (PRIORITY_RANK[e.priority] ?? 3) : 3;
}

/**
 * 列内ソート: order昇順を優先(design-reorder-and-notes.md A-3)。
 * 両者ともorder未設定の場合のみpriority(high→low)→due昇順→titleへフォールバックする。
 */
export function sortEntities(entities: Entity[]): Entity[] {
	return [...entities].sort((a, b) => {
		if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
		if (a.order !== undefined) return -1;
		if (b.order !== undefined) return 1;

		const p = priorityRank(a) - priorityRank(b);
		if (p !== 0) return p;
		const ad = a.due ?? "9999-99-99";
		const bd = b.due ?? "9999-99-99";
		if (ad !== bd) return ad < bd ? -1 : 1;
		return a.title.localeCompare(b.title);
	});
}

/** Project用/Ticket用で列定義を切替。Ticketではarchived/cancelled列を表示しない(要件§12・POS-3 AC-3) */
export function buildKanbanData(plugin: PersonalOSPlugin, mode: KanbanMode): KanbanData {
	const type: EntityType = mode;
	const statuses: readonly string[] =
		mode === "ticket" ? TICKET_STATUSES.filter((s) => s !== "archived" && s !== "cancelled") : PROJECT_STATUSES;
	const names = plugin.settings.kanbanColumnNames[mode] as Record<string, string>;
	const entities = plugin.store.listByType(type);

	const columns: KanbanColumnData[] = statuses.map((status) => ({
		status,
		label: names[status] ?? status,
		entities: sortEntities(entities.filter((e) => e.status === status)),
	}));

	return { mode, columns };
}

/**
 * 楽観的更新用: 指定pathのEntityを別列(status)へ移す。
 * changeStatus() の実I/O結果を待たずにUIへ即時反映し、失敗時は呼び出し側が元のKanbanDataへ戻す。
 */
export function moveEntityStatus(data: KanbanData, path: string, status: string): KanbanData {
	let moved: Entity | undefined;
	const withoutMoved = data.columns.map((col) => {
		const idx = col.entities.findIndex((e) => e.path === path);
		if (idx === -1) return col;
		moved = { ...col.entities[idx], status };
		return { ...col, entities: col.entities.filter((e) => e.path !== path) };
	});
	if (!moved) return data;

	return {
		...data,
		columns: withoutMoved.map((col) =>
			col.status === status ? { ...col, entities: sortEntities([...col.entities, moved as Entity]) } : col
		),
	};
}
