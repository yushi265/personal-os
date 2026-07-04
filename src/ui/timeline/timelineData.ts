import type { Entity, EntityType } from "../../domain/entity";
import { today } from "../../domain/date";
import type PersonalOSPlugin from "../../main";

export interface TimelineRow {
	path: string;
	title: string;
	type: EntityType;
	start?: string;
	due?: string;
	leftPct: number;
	widthPct: number;
	isPoint: boolean;
}

export interface TimelineData {
	rangeStart: string;
	rangeEnd: string;
	rows: TimelineRow[];
}

export const EMPTY_TIMELINE_DATA: TimelineData = { rangeStart: today(), rangeEnd: today(), rows: [] };

function dateToDays(date: string): number {
	const [y, m, d] = date.split("-").map(Number);
	return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** start/dueを持つEntityから簡易タイムライン行を構築する(design.md §18/requirements.md §18の純粋関数部分) */
export function buildTimelineRows(entities: Entity[]): TimelineData {
	const withDates = entities.filter((e) => e.start || e.due);
	if (withDates.length === 0) {
		const t = today();
		return { rangeStart: t, rangeEnd: t, rows: [] };
	}

	const allDates = withDates.flatMap((e) => [e.start, e.due].filter((d): d is string => !!d));
	const rangeStart = allDates.reduce((a, b) => (a < b ? a : b));
	const rangeEnd = allDates.reduce((a, b) => (a > b ? a : b));
	const startDays = dateToDays(rangeStart);
	const endDays = dateToDays(rangeEnd);
	const totalDays = Math.max(1, endDays - startDays);

	const rows: TimelineRow[] = withDates.map((e) => {
		const isPoint = !e.start && !!e.due;
		const s = e.start ?? (e.due as string);
		const en = e.due ?? (e.start as string);
		const leftPct = ((dateToDays(s) - startDays) / totalDays) * 100;
		const widthPct = isPoint ? 0 : Math.max(0.5, ((dateToDays(en) - dateToDays(s)) / totalDays) * 100);
		return { path: e.path, title: e.title, type: e.type, start: e.start, due: e.due, leftPct, widthPct, isPoint };
	});

	return { rangeStart, rangeEnd, rows };
}

export function buildTimelineData(plugin: PersonalOSPlugin): TimelineData {
	const entities = [...plugin.store.listByType("project"), ...plugin.store.listByType("ticket")];
	return buildTimelineRows(entities);
}
